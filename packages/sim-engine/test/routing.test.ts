import { describe, it, expect } from "vitest";
import { simulate } from "../src/index";
import { runOnce } from "../src/simulation/simulate";
import type { Graph, Level } from "../src/types";

/* Request-class routing: when the API forwards to BOTH a cache (read path) and the DB
   (write path), reads go to the cache and writes go to the DB directly — the split in the
   reference read-heavy architecture. A lone cache chain stays linear. */

const level = (readWriteRatio: number): Level => ({
  id: "rt",
  stage: 4,
  title: "rt",
  story: "",
  traffic: { profile: "steady", ratePerMin: 12000, readWriteRatio },
  allowedComponents: ["client", "api-gateway", "cache", "sql-db"],
  winConditions: { steady: {}, scenarios: [], resilience: [] },
  concepts: [],
});

// API branches to cache (reads) and DB (writes); cache falls through to DB on a miss.
const branched: Graph = {
  nodes: [
    { id: "c", type: "client" },
    { id: "a", type: "api-gateway" },
    { id: "ca", type: "cache" },
    { id: "d", type: "sql-db" },
  ],
  edges: [
    { source: "c", target: "a" },
    { source: "a", target: "ca" },
    { source: "a", target: "d" },
    { source: "ca", target: "d" },
  ],
};

const tput = (g: Graph, lvl: Level, id: string) =>
  runOnce(g, lvl, 12345, 1)!.nodes.find((n) => n.id === id)!.throughput ?? 0;

describe("request-class routing", () => {
  it("read-heavy load flows mostly through the cache", () => {
    const lvl = level(0.9); // 90% reads
    expect(tput(branched, lvl, "ca")).toBeGreaterThan(tput(branched, lvl, "d"));
  });

  it("write-heavy load flows mostly straight to the DB (writes skip the cache)", () => {
    const lvl = level(0.1); // 90% writes
    expect(tput(branched, lvl, "d")).toBeGreaterThan(tput(branched, lvl, "ca"));
  });

  it("a lone cache chain is unchanged — writes still fall through the cache to storage", () => {
    // API → Cache → DB (no separate write edge): both reads and writes traverse the cache.
    const linear: Graph = {
      nodes: [
        { id: "c", type: "client" },
        { id: "a", type: "api-gateway" },
        { id: "ca", type: "cache" },
        { id: "d", type: "sql-db" },
      ],
      edges: [
        { source: "c", target: "a" },
        { source: "a", target: "ca" },
        { source: "ca", target: "d" },
      ],
    };
    // Every request passes through the cache node, so its throughput ≈ full offered load.
    expect(tput(linear, level(0.5), "ca")).toBeGreaterThan(tput(linear, level(0.5), "d"));
  });
});

describe("requireWriteSplit (cache-aside correctness)", () => {
  const splitLevel: Level = { ...level(0.9), requireWriteSplit: true };

  it("flags a linear cache chain — writes tunnel through the read cache", () => {
    const linear: Graph = {
      nodes: [
        { id: "c", type: "client" },
        { id: "a", type: "api-gateway" },
        { id: "ca", type: "cache" },
        { id: "d", type: "sql-db" },
      ],
      edges: [
        { source: "c", target: "a" },
        { source: "a", target: "ca" },
        { source: "ca", target: "d" },
      ],
    };
    const r = simulate(linear, splitLevel, 12345);
    expect(r.dims.security).toBe(0);
    expect(r.passed).toBe(false);
    expect(r.lesson.toLowerCase()).toContain("cache");
  });

  it("passes the branched pattern — reads to cache, writes straight to the DB", () => {
    const r = simulate(branched, splitLevel, 12345);
    expect(r.dims.security).toBe(100);
    expect(r.passed).toBe(true);
  });
});

/* Regression: a cache/CDN is only a genuine "success" on a HIT. A miss must still
   reach real storage downstream — if nothing is wired behind the cache/CDN, that
   miss has nowhere to go and must fail, not be credited for work no datastore did.
   (Previously the sim marked reachedStorage on service completion, before the hit/miss
   roll — so a dangling cache/CDN silently reported ~100% availability regardless of
   its hit ratio.) */
describe("dangling cache/CDN — misses with no downstream storage must fail", () => {
  it("a CDN with no outgoing edge: only cache HITS succeed, misses vanish", () => {
    const g: Graph = {
      nodes: [
        { id: "c", type: "client" },
        { id: "cdn", type: "cdn" },
      ],
      edges: [{ source: "c", target: "cdn" }],
    };
    const lvl: Level = { ...level(1), allowedComponents: ["client", "cdn"], winConditions: { steady: { availability: 0.99 }, scenarios: [], resilience: [] } };
    const r = simulate(g, lvl, 12345);
    // CDN hitRatio is 0.85 — availability should track the hit ratio, not 100%.
    expect(r.metrics.availability).toBeGreaterThan(0.7);
    expect(r.metrics.availability).toBeLessThan(0.95);
    expect(r.passed).toBe(false);
  });

  it("a Redis cache never wired to a DB: only hits succeed, misses vanish", () => {
    const g: Graph = {
      nodes: [
        { id: "c", type: "client" },
        { id: "a", type: "api-gateway" },
        { id: "ca", type: "cache" },
      ],
      edges: [
        { source: "c", target: "a" },
        { source: "a", target: "ca" },
      ],
    };
    const lvl: Level = { ...level(0.9), winConditions: { steady: { availability: 0.99 }, scenarios: [], resilience: [] } };
    const r = simulate(g, lvl, 12345);
    // default cache hitRatio is 0.8; only the 90% read share can ever hit — writes always fail.
    expect(r.metrics.availability).toBeLessThan(0.8);
    expect(r.passed).toBe(false);
  });

  it("a properly wired cache is unaffected — misses that reach a real DB still succeed", () => {
    const g: Graph = {
      nodes: [
        { id: "c", type: "client" },
        { id: "a", type: "api-gateway" },
        { id: "ca", type: "cache" },
        { id: "d", type: "sql-db" },
      ],
      edges: [
        { source: "c", target: "a" },
        { source: "a", target: "ca" },
        { source: "ca", target: "d" },
      ],
    };
    const r = simulate(g, level(0.9), 12345);
    expect(r.metrics.availability).toBeGreaterThanOrEqual(0.99);
  });
});
