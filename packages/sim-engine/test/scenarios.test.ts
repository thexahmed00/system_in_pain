import { describe, it, expect } from "vitest";
import { simulate } from "../src/index";
import { loadLevel } from "../src/levels/loader";
import type { Graph, Level } from "../src/types";
import tinyurlJson from "../src/levels/definitions/tinyurl-1.json";

const level = loadLevel(tinyurlJson);

describe("the engine teaches the right lessons", () => {
  it("Database wired directly to the Client scores 0 on security", () => {
    const insecure: Graph = {
      nodes: [
        { id: "client-1", type: "client" },
        { id: "db-1", type: "sql-db" },
      ],
      edges: [{ source: "client-1", target: "db-1" }],
    };
    const r = simulate(insecure, level, 12345);
    expect(r.dims.security).toBe(0);
    expect(r.passed).toBe(false);
    expect(r.lesson.toLowerCase()).toContain("exposed");
  });

  it("extreme traffic collapses availability (the line explodes)", () => {
    const heavy: Level = { ...level, traffic: { ...level.traffic, ratePerMin: 120_000 } };
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
    const r = simulate(standard, heavy, 12345);
    expect(r.metrics.availability).toBeLessThan(0.9);
    expect(r.nodes.some((n) => n.status === "bottleneck" || n.status === "fail")).toBe(true);
  });

  it("adding workers (instances) lowers a box's utilization", () => {
    const heavy: Level = { ...level, traffic: { ...level.traffic, ratePerMin: 6_000 } };
    const make = (instances: number): Graph => ({
      nodes: [
        { id: "client-1", type: "client" },
        { id: "api-1", type: "api-gateway", config: { instances } },
      ],
      edges: [{ source: "client-1", target: "api-1" }],
    });
    const one = simulate(make(1), heavy, 12345).nodes.find((n) => n.id === "api-1")!;
    const four = simulate(make(4), heavy, 12345).nodes.find((n) => n.id === "api-1")!;
    expect(four.util).toBeLessThan(one.util);
  });
});
