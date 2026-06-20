import type { Dimensions, Graph, Level } from "../types";
import { modelOf } from "../components/models";
import { runOnce, type RunOnce } from "../simulation/simulate";

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export interface Score {
  dims: Dimensions;
  final: number;
  passed: boolean;
  lesson: string;
}

/** Grade a run on five outcome dimensions (never on which components are present). */
export function score(graph: Graph, base: RunOnce, level: Level, seed: number): Score {
  const w = level.winConditions;
  const m = base.metrics;

  const performance = clamp(Math.round(100 * Math.min(1, w.p99LatencyMs / Math.max(1, m.p99))));
  const reliability = clamp(Math.round(100 * Math.min(1, m.availability / w.availability)));

  // Scalability: same architecture under a deterministic 5x burst.
  const burst = runOnce(graph, level, seed ^ 0x5af3, 5);
  const scalability = burst ? clamp(Math.round(100 * burst.metrics.availability)) : 0;

  // Cost: over-budget designs scale down — punishes over-provisioning.
  const cost = clamp(Math.round(m.costPerHour <= w.maxCostPerHour ? 100 : (100 * w.maxCostPerHour) / m.costPerHour));

  // Security: a storage node reachable directly from a source is exposed → 0.
  const exposed = graph.edges.some((e) => {
    const f = modelOf(graph.nodes.find((n) => n.id === e.source)?.type ?? "");
    const tt = modelOf(graph.nodes.find((n) => n.id === e.target)?.type ?? "");
    return f?.kind === "source" && tt?.kind === "storage";
  });
  const security = exposed ? 0 : 100;

  const final = Math.round((performance + reliability + scalability + cost + security) / 5);
  const passed =
    m.availability >= w.availability &&
    m.p99 <= w.p99LatencyMs &&
    m.costPerHour <= w.maxCostPerHour &&
    security === 100;

  const hasStorage = graph.nodes.some((n) => modelOf(n.type)?.kind === "storage");

  let lesson = "";
  if (exposed)
    lesson = "Your Database is exposed directly to the Client. Apps should talk through an API layer — add an API between them.";
  else if (!hasStorage)
    lesson = "Requests have nowhere to be stored or served from — add a database so the data actually persists.";
  else if (reliability < 90 || performance < 90)
    lesson = `A node saturated under load — p99 hit ${m.p99}ms, availability ${(m.availability * 100).toFixed(1)}%. Add capacity or a faster path (a cache?).`;
  else if (scalability < 70)
    lesson = "Holds at 1× but degrades under a 5× burst. Right-size for spikes.";
  else if (cost < 90) lesson = "Over budget — over-provisioned. The right-sized design beats the over-built one.";
  else if (passed) lesson = "Solid. The system handles the load with headroom.";

  return { dims: { performance, reliability, scalability, cost, security }, final, passed, lesson };
}
