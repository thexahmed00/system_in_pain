import type { Graph, GraphNode, Level, Metrics, SimEvent, SimNodeResult, Status } from "../types";
import { createRng, exp } from "../rng/mulberry32";
import { modelOf } from "../components/models";
import { routeOf } from "./route";

const DURATION = 60; // seconds simulated
const TIMEOUT_MS = 1000; // a request slower than this is dropped
const MAX_EVENTS = 200; // cap trace size

export interface RunOnce {
  total: number;
  success: number;
  path: GraphNode[];
  metrics: Metrics;
  nodes: SimNodeResult[];
  events: SimEvent[];
}

function statusFor(util: number): Status {
  if (util >= 1) return "fail";
  if (util >= 0.8) return "bottleneck";
  if (util >= 0.5) return "load";
  return "healthy";
}

/**
 * One deterministic run at a traffic multiplier. Per-request pass over the linear
 * route; each node is a single-server queue. Emits metrics + an event trace.
 * Returns null when there's no runnable route.
 *
 * NOTE (v1): timestamps in the trace are approximate (the per-request model has no
 * global clock). Precise ordering arrives with the true event scheduler.
 */
export function runOnce(graph: Graph, level: Level, seed: number, mult: number): RunOnce | null {
  const path = routeOf(graph);
  if (!path) return null;

  const rng = createRng(seed);
  const rate = (level.traffic.ratePerMin / 60) * mult; // req/s

  // Poisson arrivals over the window
  const arrivals: number[] = [];
  let t = 0;
  while ((t += exp(rng, 1 / rate)) <= DURATION) arrivals.push(t);
  const total = arrivals.length;

  // per-node queue state
  const state: Record<string, { free: number; busy: number; firstWaitAt?: number }> = {};
  for (const n of path) state[n.id] = { free: 0, busy: 0 };

  const latencies: number[] = [];
  const timeoutEvents: SimEvent[] = [];
  let success = 0;

  for (const a of arrivals) {
    let cur = a;
    let dropped = false;
    for (const n of path) {
      const model = modelOf(n.type)!;
      if (model.kind === "source") continue;
      const st = state[n.id];
      const start = Math.max(cur, st.free);
      if (start - cur > 1e-9 && st.firstWaitAt === undefined) st.firstWaitAt = a; // queue formed
      const base = model.baseMs / 1000;
      const svc = base * 0.8 + exp(rng, base * 0.2);
      const fin = start + svc;
      st.free = fin;
      st.busy += svc;
      cur = fin;
      if ((cur - a) * 1000 > TIMEOUT_MS) {
        dropped = true;
        if (timeoutEvents.length < MAX_EVENTS) {
          timeoutEvents.push({ t: round2(cur), node: n.id, type: "timeout" });
        }
        break;
      }
    }
    if (!dropped) {
      success++;
      latencies.push((cur - a) * 1000);
    }
  }

  latencies.sort((x, y) => x - y);
  const pct = (q: number) =>
    latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))] : TIMEOUT_MS;

  const cost = path.reduce((c, n) => c + (modelOf(n.type)?.cost ?? 0), 0);

  const nodes: SimNodeResult[] = path
    .filter((n) => modelOf(n.type)!.kind !== "source")
    .map((n) => {
      const util = state[n.id].busy / DURATION;
      return { id: n.id, util, status: statusFor(util) };
    });

  const saturationEvents: SimEvent[] = nodes
    .filter((n) => n.util >= 0.8)
    .map((n) => ({ t: round2(state[n.id].firstWaitAt ?? 0), node: n.id, type: "saturation", util: n.util }));

  const events = [...saturationEvents, ...timeoutEvents].sort((e1, e2) => e1.t - e2.t).slice(0, MAX_EVENTS);

  return {
    total,
    success,
    path,
    metrics: {
      p99: Math.round(pct(0.99)),
      p50: Math.round(pct(0.5)),
      availability: total ? success / total : 0,
      costPerHour: cost,
    },
    nodes,
    events,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
