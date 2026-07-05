import { describe, it, expect } from "vitest";
import { score } from "../src/scoring/score";
import { runOnce } from "../src/simulation/simulate";
import { loadLevel } from "../src/levels/loader";
import type { Graph, Level } from "../src/types";
import tinyurlJson from "../src/levels/definitions/tinyurl-1.json";

/* Direct unit tests for the grading brain (score.ts), separate from the black-box
   simulate() tests. tinyurl-1 sets p99 + availability + cost gates and NO scenario,
   so it exercises every dimension except scalability. */
const level = loadLevel(tinyurlJson);
const SEED = 12345;

/** Grade a graph on tinyurl-1 via the same path index.ts uses (runOnce → score). */
function grade(graph: Graph, lvl: Level = level) {
  const base = runOnce(graph, lvl, SEED, 1);
  expect(base).not.toBeNull();
  return score(graph, base!, lvl, SEED);
}

const standard: Graph = {
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

describe("score() — security", () => {
  it("a storage node reachable straight from the client scores 0 and fails", () => {
    const exposed: Graph = {
      nodes: [
        { id: "client-1", type: "client" },
        { id: "db-1", type: "sql-db" },
      ],
      edges: [{ source: "client-1", target: "db-1" }],
    };
    const s = grade(exposed);
    expect(s.dims.security).toBe(0);
    expect(s.passed).toBe(false);
    expect(s.lesson.toLowerCase()).toContain("exposed");
    // security is graded on every architecture, so it is always active
    expect(s.activeDimensions).toContain("security");
  });

  it("routing through an API keeps security at 100", () => {
    expect(grade(standard).dims.security).toBe(100);
  });
});

describe("score() — active dimensions", () => {
  it("averages only the dimensions the level tests (tinyurl has no spike → no scalability)", () => {
    const s = grade(standard);
    expect(s.activeDimensions).toEqual(["performance", "reliability", "cost", "security"]);
    expect(s.activeDimensions).not.toContain("scalability");
    const avg = Math.round(
      s.activeDimensions.reduce((a, k) => a + s.dims[k], 0) / s.activeDimensions.length,
    );
    expect(s.final).toBe(avg);
  });

  it("activates scalability when the level defines a spike scenario", () => {
    const spikeLevel: Level = {
      id: "spike-test",
      stage: 1,
      title: "Spike",
      story: "",
      traffic: { profile: "steady", ratePerMin: 120, readWriteRatio: 0.9 },
      allowedComponents: ["client", "api-gateway", "sql-db"],
      winConditions: {
        steady: { availability: 0.99, p99LatencyMs: 300, maxCostPerHour: 20 },
        scenarios: [{ name: "black-friday", trafficMultiplier: 5, mustMeet: { availability: 0.9 } }],
        resilience: [],
      },
      concepts: [],
    };
    const s = grade(standard, spikeLevel);
    expect(s.activeDimensions).toContain("scalability");
    expect(s.scenarios).toHaveLength(1);
    expect(s.dims.scalability).toBeGreaterThanOrEqual(0);
    expect(s.dims.scalability).toBeLessThanOrEqual(100);
  });
});

describe("score() — cost", () => {
  it("a within-budget design gets full cost marks", () => {
    // client→api→db = $2 + $3 = $5, under the $6 tinyurl budget
    expect(grade(standard).dims.cost).toBe(100);
  });

  it("an over-budget design scales the cost dimension down and fails", () => {
    // 3 API replicas ($6) + db ($3) = $9 > $6 budget; over-provisioned, so perf/reliability
    // stay healthy and the lesson lands on the cost branch.
    const overBuilt: Graph = {
      nodes: [
        { id: "client-1", type: "client" },
        { id: "api-1", type: "api-gateway", config: { instances: 3 } },
        { id: "db-1", type: "sql-db" },
      ],
      edges: [
        { source: "client-1", target: "api-1" },
        { source: "api-1", target: "db-1" },
      ],
    };
    const s = grade(overBuilt);
    expect(s.dims.cost).toBeLessThan(100);
    expect(s.passed).toBe(false);
    expect(s.lesson.toLowerCase()).toContain("budget");
  });
});

describe("score() — lessons & pass", () => {
  it("a graph with no storage teaches that data has nowhere to live", () => {
    const noStore: Graph = {
      nodes: [
        { id: "client-1", type: "client" },
        { id: "api-1", type: "api-gateway" },
      ],
      edges: [{ source: "client-1", target: "api-1" }],
    };
    const s = grade(noStore);
    expect(s.passed).toBe(false);
    expect(s.lesson.toLowerCase()).toContain("database");
  });

  it("the textbook Client→API→DB solution passes with headroom", () => {
    const s = grade(standard);
    expect(s.passed).toBe(true);
    expect(s.final).toBeGreaterThanOrEqual(80);
    expect(s.lesson.toLowerCase()).toContain("solid");
  });

  it("is deterministic — same inputs grade identically", () => {
    expect(grade(standard)).toEqual(grade(standard));
  });
});
