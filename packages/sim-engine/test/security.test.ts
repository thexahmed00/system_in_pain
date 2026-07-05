import { describe, it, expect } from "vitest";
import { simulate } from "../src/index";
import type { Graph, Level } from "../src/types";

/* Pillar: edge security. Attack traffic (traffic.maliciousRatio) consumes capacity
   like real traffic but never cache-hits and never counts as a user. A security node
   (WAF / Rate Limiter) blocks a share of it at the edge. Scoring is observed-outcome:
   the Security dimension is zeroed when the flood reaches the origin unfiltered —
   owning a WAF that isn't in the request path earns nothing. */

const attackLevel: Level = {
  id: "bot-flood",
  stage: 4,
  title: "Bot Flood",
  story: "",
  // 350 r/s, half of it bots. Legit load alone fits comfortably behind a cache;
  // the unfiltered flood pushes the DB past its cap.
  traffic: { profile: "steady", ratePerMin: 21000, readWriteRatio: 0.9, maliciousRatio: 0.5 },
  allowedComponents: ["client", "waf", "rate-limiter", "api-gateway", "cache", "sql-db"],
  winConditions: {
    steady: { minThroughputRps: 150, maxErrorRate: 0.02, p99LatencyMs: 250, availability: 0.99, maxCostPerHour: 9 },
    scenarios: [],
    resilience: [],
  },
  concepts: [],
};

const g = (front?: "waf" | "rate-limiter"): Graph => {
  const nodes = [
    { id: "c", type: "client" },
    ...(front ? [{ id: "sec", type: front }] : []),
    { id: "a", type: "api-gateway" },
    { id: "ca", type: "cache" },
    { id: "d", type: "sql-db" },
  ];
  const chain = ["c", ...(front ? ["sec"] : []), "a", "ca", "d"];
  const edges = chain.slice(1).map((target, i) => ({ source: chain[i], target }));
  return { nodes, edges };
};

describe("attack traffic + edge security", () => {
  it("unfiltered flood: bots bypass the cache, users starve, Security = 0", () => {
    const r = simulate(g(), attackLevel, 12345);
    expect(r.ok).toBe(true);
    // bots stole origin capacity from real users
    expect(r.metrics.availability).toBeLessThan(0.9);
    expect(r.dims.security).toBe(0);
    expect(r.passed).toBe(false);
    expect(r.lesson.toLowerCase()).toContain("waf");
  });

  it("WAF in the path blocks the flood — users unaffected, Security = 100", () => {
    const r = simulate(g("waf"), attackLevel, 12345);
    expect(r.metrics.availability).toBeGreaterThanOrEqual(0.99);
    expect(r.dims.security).toBe(100);
    expect(r.passed).toBe(true);
  });

  it("Rate Limiter also works — a second valid design, not a single golden answer", () => {
    const r = simulate(g("rate-limiter"), attackLevel, 12345);
    expect(r.metrics.availability).toBeGreaterThanOrEqual(0.99);
    expect(r.dims.security).toBe(100);
    expect(r.passed).toBe(true);
  });

  it("levels without maliciousRatio are untouched (rng stream + security grading)", () => {
    const calm: Level = { ...attackLevel, traffic: { ...attackLevel.traffic, maliciousRatio: undefined } };
    const r = simulate(g(), calm, 12345);
    expect(r.dims.security).toBe(100); // no attack, no structural violation
    expect(r.metrics.availability).toBeGreaterThanOrEqual(0.99);
  });

  it("is deterministic under attack", () => {
    expect(simulate(g("waf"), attackLevel, 777)).toEqual(simulate(g("waf"), attackLevel, 777));
  });
});
