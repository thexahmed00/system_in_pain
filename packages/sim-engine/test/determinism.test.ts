import { describe, it, expect } from "vitest";
import { simulate } from "../src/index";
import { loadLevel } from "../src/levels/loader";
import type { Graph } from "../src/types";
import tinyurlJson from "../src/levels/definitions/tinyurl-1.json";

const level = loadLevel(tinyurlJson);

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

describe("determinism gate", () => {
  it("same graph + same seed → identical result, twice", () => {
    const a = simulate(standard, level, 12345);
    const b = simulate(standard, level, 12345);
    expect(a).toEqual(b);
  });

  it("Client → API → Database passes Level 1", () => {
    const r = simulate(standard, level, 12345);
    expect(r.ok).toBe(true);
    expect(r.dims.security).toBe(100);
    expect(r.metrics.availability).toBeGreaterThanOrEqual(level.winConditions.steady.availability!);
    expect(r.passed).toBe(true);
    expect(r.final).toBeGreaterThanOrEqual(80);
  });
});
