import { describe, it, expect } from "vitest";
import { simulate } from "../src/index";
import type { Graph, Level } from "../src/types";

/* Pillar: Separation of concerns. When a level sets requireAppTier, the API Gateway is
   ingress only — wiring it straight to storage is a layering violation (security 0).
   The app tier (a Backend) must sit between the gateway and the data. Light traffic, so
   the ONLY thing under test is the layering, not capacity. */

const base = {
  id: "service-tiers",
  stage: 3,
  title: "Service Tiers",
  story: "",
  traffic: { profile: "steady", ratePerMin: 9000, readWriteRatio: 0.8 },
  allowedComponents: ["client", "api-gateway", "backend", "sql-db"],
  winConditions: {
    steady: { availability: 0.99, p99LatencyMs: 250, maxCostPerHour: 12 },
    scenarios: [],
    resilience: [],
  },
  concepts: [],
} satisfies Level;
const layeredLevel: Level = { ...base, requireAppTier: true };

const gatewayToDb: Graph = {
  nodes: [
    { id: "c", type: "client" },
    { id: "a", type: "api-gateway" },
    { id: "d", type: "sql-db" },
  ],
  edges: [
    { source: "c", target: "a" },
    { source: "a", target: "d" },
  ],
};
const withBackend: Graph = {
  nodes: [
    { id: "c", type: "client" },
    { id: "a", type: "api-gateway" },
    { id: "b", type: "backend" },
    { id: "d", type: "sql-db" },
  ],
  edges: [
    { source: "c", target: "a" },
    { source: "a", target: "b" },
    { source: "b", target: "d" },
  ],
};

describe("app-tier (separation of concerns)", () => {
  it("gateway wired straight to storage is a layering violation", () => {
    const r = simulate(gatewayToDb, layeredLevel, 12345);
    expect(r.dims.security).toBe(0);
    expect(r.passed).toBe(false);
    expect(r.lesson.toLowerCase()).toContain("backend");
  });

  it("routing the gateway through a backend app tier passes", () => {
    const r = simulate(withBackend, layeredLevel, 12345);
    expect(r.dims.security).toBe(100);
    expect(r.passed).toBe(true);
  });

  it("is opt-in — the same gateway→DB graph is fine on a level that doesn't require an app tier", () => {
    const r = simulate(gatewayToDb, base, 12345); // requireAppTier unset
    expect(r.dims.security).toBe(100);
  });
});
