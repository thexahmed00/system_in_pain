import { describe, it, expect } from 'vitest';
import { simulate } from '../src/index';
import type { Graph, Level } from '../src/types';

// L6 — async writes as BURST absorption: steady write load fits the DB, but a 3×
// ingest burst mid-run drowns a synchronous path. A queue ACKs the burst and drains
// it with the DB's spare capacity. (A queue can never fix sustained overload — that
// is the write-loss rule — so the level tests a burst, not a bigger firehose.)
const L6: Level = {
  id: 'event-pipeline-6', stage: 3, title: 'Event Pipeline',
  story: '', traffic: { profile: 'bursty', ratePerMin: 9000, readWriteRatio: 0.05 },
  allowedComponents: ['client','api-gateway','queue','sql-db'],
  failureInjections: [{ kind: 'spike', atSecond: 25, durationSec: 10, multiplier: 3 }],
  winConditions: {
    steady: { minThroughputRps: 150, maxErrorRate: 0.05, p99LatencyMs: 300, availability: 0.96, maxCostPerHour: 7 },
    scenarios: [], resilience: [],
  },
  concepts: ['Async Writes'],
};

// L7 level definition
const L7: Level = {
  id: 'global-reads-7', stage: 4, title: 'Global Reads',
  story: '', traffic: { profile: 'steady', ratePerMin: 30000, readWriteRatio: 0.95 },
  allowedComponents: ['client','cdn','api-gateway','cache','sql-db'],
  winConditions: {
    steady: { minThroughputRps: 400, maxErrorRate: 0.02, p99LatencyMs: 150, availability: 0.99, maxCostPerHour: 12 },
    scenarios: [], resilience: [],
  },
  concepts: ['CDN'],
};

// L8 level definition
const L8: Level = {
  id: 'viral-scale-8', stage: 4, title: 'Viral Scale',
  story: '', traffic: { profile: 'steady', ratePerMin: 126000, readWriteRatio: 0.95 },
  allowedComponents: ['client','load-balancer','api-gateway','cache','sql-db'],
  winConditions: {
    steady: { minThroughputRps: 1500, maxErrorRate: 0.02, p99LatencyMs: 200, availability: 0.99, maxCostPerHour: 35 },
    scenarios: [], resilience: [],
  },
  concepts: ['Load Balancing'],
};

describe('New level mechanics', () => {

  // L6 — queue absorbs the burst, sync backlog is fatal
  it('L6: api→queue→db PASSES (queue ACKs the burst, DB drains it)', () => {
    const g: Graph = {
      nodes: [
        { id: 'c', type: 'client' },
        { id: 'a', type: 'api-gateway' },
        { id: 'q', type: 'queue' },
        { id: 'd', type: 'sql-db' },
      ],
      edges: [
        { source: 'c', target: 'a' },
        { source: 'a', target: 'q' },
        { source: 'q', target: 'd' },
      ],
    };
    const r = simulate(g, L6);
    console.log('L6 queue win: avail=', r.metrics.availability.toFixed(3), 'p99=', r.metrics.p99, 'passed=', r.passed);
    expect(r.metrics.availability).toBeGreaterThanOrEqual(0.96);
    expect(r.passed).toBe(true);
  });

  it('L6: split routing — api→{db, queue→db} sends writes to the queue, reads direct', () => {
    const g: Graph = {
      nodes: [
        { id: 'c', type: 'client' },
        { id: 'a', type: 'api-gateway' },
        { id: 'q', type: 'queue' },
        { id: 'd', type: 'sql-db' },
      ],
      edges: [
        { source: 'c', target: 'a' },
        { source: 'a', target: 'd' },
        { source: 'a', target: 'q' },
        { source: 'q', target: 'd' },
      ],
    };
    const r = simulate(g, L6);
    console.log('L6 split win: avail=', r.metrics.availability.toFixed(3), 'p99=', r.metrics.p99, 'passed=', r.passed);
    // writes flow a→q (not a→d twice); reads flow a→d — no fan-out doubling
    const aToQ = r.edgeFlows.find((f) => f.source === 'a' && f.target === 'q')!;
    const aToD = r.edgeFlows.find((f) => f.source === 'a' && f.target === 'd')!;
    expect(aToQ.writes).toBeGreaterThan(0);
    expect(aToQ.reads).toBe(0);
    expect(aToD.writes).toBe(0);
    expect(aToD.reads).toBeGreaterThan(0);
    expect(r.passed).toBe(true);
  });

  it('L6: synchronous api→db FAILS (burst backlog wrecks the run)', () => {
    const g: Graph = {
      nodes: [
        { id: 'c', type: 'client' },
        { id: 'a', type: 'api-gateway' },
        { id: 'd', type: 'sql-db' },
      ],
      edges: [
        { source: 'c', target: 'a' },
        { source: 'a', target: 'd' },
      ],
    };
    const r = simulate(g, L6);
    console.log('L6 sync fail: avail=', r.metrics.availability.toFixed(3), 'passed=', r.passed);
    expect(r.metrics.availability).toBeLessThan(0.9);
    expect(r.passed).toBe(false);
  });

  it('L6: db×2 rides the burst but blows the budget — no buying your way out', () => {
    const g: Graph = {
      nodes: [
        { id: 'c', type: 'client' },
        { id: 'a', type: 'api-gateway' },
        { id: 'd', type: 'sql-db', config: { instances: 2 } },
      ],
      edges: [
        { source: 'c', target: 'a' },
        { source: 'a', target: 'd' },
      ],
    };
    const r = simulate(g, L6);
    console.log('L6 db2 fail: avail=', r.metrics.availability.toFixed(3), 'cost=', r.metrics.costPerHour, 'passed=', r.passed);
    expect(r.metrics.costPerHour).toBeGreaterThan(7);
    expect(r.passed).toBe(false);
  });

  // L7 — CDN wins, raw api→db fails
  it('L7: cdn→api→db PASSES (CDN absorbs reads)', () => {
    const g: Graph = {
      nodes: [
        { id: 'c', type: 'client' },
        { id: 'cdn', type: 'cdn' },
        { id: 'a', type: 'api-gateway' },
        { id: 'd', type: 'sql-db' },
      ],
      edges: [
        { source: 'c', target: 'cdn' },
        { source: 'cdn', target: 'a' },
        { source: 'a', target: 'd' },
      ],
    };
    const r = simulate(g, L7);
    console.log('L7 cdn win: avail=', r.metrics.availability.toFixed(3), 'p99=', r.metrics.p99, 'passed=', r.passed);
    expect(r.metrics.availability).toBeGreaterThanOrEqual(0.99);
    expect(r.passed).toBe(true);
  });

  it('L7: api→db FAILS (DB saturates at 500 r/s)', () => {
    const g: Graph = {
      nodes: [
        { id: 'c', type: 'client' },
        { id: 'a', type: 'api-gateway' },
        { id: 'd', type: 'sql-db' },
      ],
      edges: [
        { source: 'c', target: 'a' },
        { source: 'a', target: 'd' },
      ],
    };
    const r = simulate(g, L7);
    console.log('L7 no-cdn fail: avail=', r.metrics.availability.toFixed(3), 'passed=', r.passed);
    expect(r.metrics.availability).toBeLessThan(0.5);
    expect(r.passed).toBe(false);
  });

  // L8 — LB + 2×api wins; single api×4 (maxInst=4 cap) fails
  it('L8: lb→[api×3,api×3]→cache→db×3 PASSES', () => {
    const g: Graph = {
      nodes: [
        { id: 'c', type: 'client' },
        { id: 'lb', type: 'load-balancer' },
        { id: 'a1', type: 'api-gateway', config: { instances: 3 } },
        { id: 'a2', type: 'api-gateway', config: { instances: 3 } },
        { id: 'cache', type: 'cache' },
        { id: 'd', type: 'sql-db', config: { instances: 3 } },
      ],
      edges: [
        { source: 'c', target: 'lb' },
        { source: 'lb', target: 'a1' },
        { source: 'lb', target: 'a2' },
        { source: 'a1', target: 'cache' },
        { source: 'a2', target: 'cache' },
        { source: 'cache', target: 'd' },
      ],
    };
    const r = simulate(g, L8);
    console.log('L8 lb win: avail=', r.metrics.availability.toFixed(3), 'cost=', r.metrics.costPerHour, 'passed=', r.passed);
    expect(r.metrics.availability).toBeGreaterThanOrEqual(0.99);
    expect(r.passed).toBe(true);
  });

  it('L8: api×4→cache→db×3 FAILS (capped at 2000 r/s < 2100 needed)', () => {
    const g: Graph = {
      nodes: [
        { id: 'c', type: 'client' },
        { id: 'a', type: 'api-gateway', config: { instances: 4 } },
        { id: 'cache', type: 'cache' },
        { id: 'd', type: 'sql-db', config: { instances: 3 } },
      ],
      edges: [
        { source: 'c', target: 'a' },
        { source: 'a', target: 'cache' },
        { source: 'cache', target: 'd' },
      ],
    };
    const r = simulate(g, L8);
    console.log('L8 no-lb fail: avail=', r.metrics.availability.toFixed(3), 'passed=', r.passed);
    expect(r.metrics.availability).toBeLessThan(0.5);
    expect(r.passed).toBe(false);
  });
});

/* Regression: maxInstances must be enforced by the engine itself, not just the UI
   stepper. The backend re-runs this exact engine to verify a submitted score (PRD
   §5.4) — a crafted graph is untrusted input, so a node requesting more instances
   than its maxInstances allows must be clamped at the source, both for capacity and
   for cost (excess instances should grant zero throughput and cost nothing extra). */
describe('maxInstances is enforced by the simulator, not just the client UI', () => {
  const L: Level = {
    id: 'clamp', stage: 1, title: 'clamp', story: '',
    traffic: { profile: 'steady', ratePerMin: 42000, readWriteRatio: 0.95 },
    allowedComponents: ['client', 'api-gateway', 'sql-db'],
    winConditions: { steady: { availability: 0.99 }, scenarios: [], resilience: [] },
    concepts: [],
  };
  const crafted: Graph = {
    nodes: [
      { id: 'c', type: 'client' },
      { id: 'a', type: 'api-gateway', config: { instances: 3 } },
      { id: 'd', type: 'sql-db', config: { instances: 10 } }, // maxInstances is 3
    ],
    edges: [{ source: 'c', target: 'a' }, { source: 'a', target: 'd' }],
  };

  it('clamps capacity to maxInstances (10 requested, 3 allowed → still saturates)', () => {
    const r = simulate(crafted, L);
    expect(r.metrics.availability).toBeLessThan(0.5);
    expect(r.passed).toBe(false);
  });

  it('clamps cost to maxInstances too — excess instances are free (and useless)', () => {
    const r = simulate(crafted, L);
    // db: 3 (clamped) × $3 + api: 3 × $2 = 15, NOT 10×3 + 3×2 = 36
    expect(r.metrics.costPerHour).toBe(15);
  });
});
