import type { Graph, Level, SimResult } from "./types";
import { runOnce } from "./simulation/simulate";
import { score } from "./scoring/score";

export * from "./types";
export { COMPONENT_MODELS, modelOf } from "./components/models";
export { loadLevel } from "./levels/loader";
export { levelSchema } from "./levels/schema";

/**
 * The engine's single entry point. Runs the simulation once at normal traffic,
 * grades the outcome, and returns one complete result. The client and the
 * backend both call exactly this — same input + seed → identical result.
 */
export function simulate(graph: Graph, level: Level, seed = 12345): SimResult {
  const base = runOnce(graph, level, seed, 1);
  if (!base) {
    return {
      ok: false,
      error: "Connect a Client to a terminal node to run.",
      metrics: { p99: 0, p50: 0, availability: 0, costPerHour: 0, throughput: 0 },
      nodes: [],
      events: [],
      dims: { performance: 0, reliability: 0, scalability: 0, cost: 0, security: 0 },
      activeDimensions: [],
      final: 0,
      passed: false,
      lesson: "",
      scenarios: [],
      stars: [],
      edgeFlows: [],
    };
  }
  const sc = score(graph, base, level, seed);
  return {
    ok: true,
    metrics: base.metrics,
    nodes: base.nodes,
    events: base.events,
    dims: sc.dims,
    activeDimensions: sc.activeDimensions,
    final: sc.final,
    passed: sc.passed,
    lesson: sc.lesson,
    scenarios: sc.scenarios,
    stars: sc.stars,
    edgeFlows: base.edgeFlows,
  };
}
