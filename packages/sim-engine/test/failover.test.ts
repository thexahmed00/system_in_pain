import { describe, it, expect } from "vitest";
import { simulate } from "../src/index";
import type { Graph, Level } from "../src/types";

/* Pillar: Redundancy / Failover. A node-down injection removes the primary DB for a
   window mid-run. A lone DB drops every request during the outage (availability
   craters); a hot db-standby takes over so the design rides through. Same seed →
   deterministic, so these thresholds are stable. */

// 60s run; kill the SQL primary from t=20s for 20s (a third of the run).
const outageLevel: Level = {
  id: "always-on",
  stage: 4,
  title: "Always On",
  story: "",
  traffic: { profile: "steady", ratePerMin: 6000, readWriteRatio: 0.5 },
  allowedComponents: ["client", "api-gateway", "sql-db", "db-standby"],
  failureInjections: [{ kind: "node-down", atSecond: 20, durationSec: 20, nodeType: "sql-db" }],
  winConditions: {
    steady: { availability: 0.95, p99LatencyMs: 400, maxCostPerHour: 12 },
    scenarios: [],
    resilience: [],
  },
  concepts: [],
};

const loneDb: Graph = {
  nodes: [
    { id: "client-1", type: "client" },
    { id: "api-1", type: "api-gateway" },
    { id: "db-1", type: "sql-db" },
  ],
  edges: [
    { source: "client-1", target: "api-1" },
    { source: "api-1", target: "db-1" },
  ],
};

// API forwards to the primary normally, to the standby only while the primary is down.
const withStandby: Graph = {
  nodes: [
    { id: "client-1", type: "client" },
    { id: "api-1", type: "api-gateway" },
    { id: "db-1", type: "sql-db" },
    { id: "standby-1", type: "db-standby" },
  ],
  edges: [
    { source: "client-1", target: "api-1" },
    { source: "api-1", target: "db-1" },
    { source: "api-1", target: "standby-1" },
  ],
};

describe("failover pillar", () => {
  it("a lone DB fails the outage — availability craters while it is down", () => {
    const r = simulate(loneDb, outageLevel, 12345);
    expect(r.ok).toBe(true);
    // ~1/3 of the run has no datastore → well below the 0.95 gate
    expect(r.metrics.availability).toBeLessThan(0.9);
    expect(r.passed).toBe(false);
    // teaches redundancy, not "add capacity"
    expect(r.lesson.toLowerCase()).toContain("standby");
  });

  it("a hot standby rides through the outage and passes", () => {
    const r = simulate(withStandby, outageLevel, 12345);
    expect(r.ok).toBe(true);
    expect(r.metrics.availability).toBeGreaterThanOrEqual(0.95);
    expect(r.passed).toBe(true);
  });

  it("the standby does not steal steady-state traffic (no double-load fan-out)", () => {
    // With no outage, the standby should receive ~no traffic — the primary serves all.
    const noOutage: Level = { ...outageLevel, failureInjections: [] };
    const r = simulate(withStandby, noOutage, 12345);
    const standby = r.nodes.find((n) => n.id === "standby-1");
    const primary = r.nodes.find((n) => n.id === "db-1");
    expect(standby?.throughput ?? 0).toBe(0);
    expect(primary?.throughput ?? 0).toBeGreaterThan(0);
  });

  it("is deterministic", () => {
    expect(simulate(withStandby, outageLevel, 777)).toEqual(simulate(withStandby, outageLevel, 777));
  });
});
