import { CATALOG, type Level } from "./level-data";

/* =========================================================================
   PREVIEW SIM — placeholder deterministic engine for the play screen.
   Reuses the validated queueing math from the spike prototype so Run does
   something real + deterministic NOW. Will be replaced by the shared
   `engine/` package (tasks.md tasks 9–11) that the backend also re-runs.
   Do not build production scoring on this — it is intentionally compact.
   ========================================================================= */

export type Status = "healthy" | "load" | "bottleneck" | "fail";

export interface SimNodeResult { id: string; util: number; status: Status }
export interface SimResult {
  ok: boolean;
  error?: string;
  metrics: { p99: number; p50: number; availability: number; costPerHour: number };
  nodes: SimNodeResult[];
  dims: { performance: number; reliability: number; scalability: number; cost: number; security: number };
  final: number;
  passed: boolean;
  lesson: string;
}

export interface Graph {
  nodes: { id: string; type: string }[];
  edges: { source: string; target: string }[];
}

const TIMEOUT_MS = 1000;
const clamp = (v: number) => Math.max(0, Math.min(100, v));

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const expSample = (rng: () => number, mean: number) => (mean <= 0 ? 0 : -mean * Math.log(1 - rng()));

function routeOf(g: Graph): { id: string; type: string }[] | null {
  const src = g.nodes.find((n) => CATALOG[n.type]?.kind === "source");
  if (!src) return null;
  const out: Record<string, string[]> = {};
  for (const e of g.edges) (out[e.source] ||= []).push(e.target);
  const path = [src];
  const seen = new Set([src.id]);
  let cur = src;
  while (out[cur.id]?.length) {
    const nextId = out[cur.id][0];
    if (seen.has(nextId)) break;
    const next = g.nodes.find((n) => n.id === nextId);
    if (!next) break;
    path.push(next); seen.add(next.id); cur = next;
  }
  return path.length >= 2 ? path : null;
}

function statusFor(util: number): Status {
  if (util >= 1) return "fail";
  if (util >= 0.8) return "bottleneck";
  if (util >= 0.5) return "load";
  return "healthy";
}

function runOnce(g: Graph, level: Level, seed: number, mult: number) {
  const rng = mulberry32(seed);
  const rate = (level.traffic.ratePerMin / 60) * mult;
  const DURATION = 60;
  const path = routeOf(g);
  if (!path) return null;

  const arrivals: number[] = [];
  let t = 0;
  while ((t += expSample(rng, 1 / rate)) <= DURATION) arrivals.push(t);
  const total = arrivals.length;

  const state: Record<string, { free: number[]; busy: number; spec: typeof CATALOG[string] }> = {};
  for (const n of path) state[n.id] = { free: [0], busy: 0, spec: CATALOG[n.type] };

  const lat: number[] = [];
  let success = 0;
  for (const a of arrivals) {
    let cur = a, drop = false;
    for (const n of path) {
      const st = state[n.id];
      if (st.spec.kind === "source") continue;
      const start = Math.max(cur, st.free[0]);
      const base = st.spec.baseMs / 1000;
      const svc = base * 0.8 + expSample(rng, base * 0.2);
      const fin = start + svc;
      st.free[0] = fin; st.busy += svc; cur = fin;
      if ((cur - a) * 1000 > TIMEOUT_MS) { drop = true; break; }
    }
    if (!drop) { success++; lat.push((cur - a) * 1000); }
  }
  lat.sort((x, y) => x - y);
  const p = (q: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(q * lat.length))] : TIMEOUT_MS);
  const cost = path.reduce((c, n) => c + CATALOG[n.type].cost, 0);
  const nodes: SimNodeResult[] = path
    .filter((n) => CATALOG[n.type].kind !== "source")
    .map((n) => {
      const util = state[n.id].busy / DURATION;
      return { id: n.id, util, status: statusFor(util) };
    });

  return {
    total, success, path,
    metrics: { p99: Math.round(p(0.99)), p50: Math.round(p(0.5)), availability: total ? success / total : 0, costPerHour: cost },
    nodes,
  };
}

export function simulate(g: Graph, level: Level, seed = 12345): SimResult {
  const base = runOnce(g, level, seed, 1);
  const empty: SimResult = {
    ok: false, error: "Connect a Client to a terminal node to run.",
    metrics: { p99: 0, p50: 0, availability: 0, costPerHour: 0 },
    nodes: [], dims: { performance: 0, reliability: 0, scalability: 0, cost: 0, security: 0 },
    final: 0, passed: false, lesson: "",
  };
  if (!base) return empty;

  const w = level.winConditions;
  const m = base.metrics;
  const performance = clamp(Math.round(100 * Math.min(1, w.p99LatencyMs / Math.max(1, m.p99))));
  const reliability = clamp(Math.round(100 * Math.min(1, m.availability / w.availability)));
  const burst = runOnce(g, level, seed ^ 0x5af3, 5);
  const scalability = burst ? clamp(Math.round(100 * burst.metrics.availability)) : 0;
  const cost = clamp(Math.round(m.costPerHour <= w.maxCostPerHour ? 100 : (100 * w.maxCostPerHour) / m.costPerHour));
  const exposed = g.edges.some((e) => {
    const f = g.nodes.find((n) => n.id === e.source);
    const tt = g.nodes.find((n) => n.id === e.target);
    return f && tt && CATALOG[f.type]?.kind === "source" && CATALOG[tt.type]?.kind === "storage";
  });
  const security = exposed ? 0 : 100;
  const final = Math.round((performance + reliability + scalability + cost + security) / 5);
  const passed = m.availability >= w.availability && m.p99 <= w.p99LatencyMs && m.costPerHour <= w.maxCostPerHour && security === 100;

  let lesson = "";
  if (exposed) lesson = "Your Database is exposed directly to the Client. Apps should talk through an API layer — add an API between them.";
  else if (reliability < 90 || performance < 90) lesson = `A node saturated under load — p99 hit ${m.p99}ms, availability ${(m.availability * 100).toFixed(1)}%. Add capacity or a faster path (a cache?).`;
  else if (scalability < 70) lesson = "Holds at 1× but degrades under a 5× burst. Right-size for spikes.";
  else if (cost < 90) lesson = "Over budget — over-provisioned. The right-sized design beats the over-built one.";
  else if (passed) lesson = "Solid. The system handles the load with headroom.";

  return { ok: true, metrics: m, nodes: base.nodes, dims: { performance, reliability, scalability, cost, security }, final, passed, lesson };
}
