import type { DimensionKey, Dimensions, Graph, Level, Metrics, ScenarioResult, StarResult, Thresholds } from "../types";
import { modelOf } from "../components/models";
import { indexGraph } from "../simulation/graph";
import { runOnce, type RunOnce } from "../simulation/simulate";

/** Non-source node count — used by minimalism challenges. */
const componentCount = (graph: Graph) => graph.nodes.filter((n) => modelOf(n.type)?.kind !== "source").length;

/** Stars: "Solved" (the pass) + each level challenge. Challenges require a solve first. */
function computeStars(graph: Graph, level: Level, m: Metrics, security: number, passed: boolean, seed: number): StarResult[] {
  const stars: StarResult[] = [{ id: "solved", label: "Solved", hint: "Pass the level", earned: passed }];
  const comps = componentCount(graph);
  for (const ch of level.challenges ?? []) {
    let earned = passed;
    if (ch.maxCostPerHour != null) earned &&= m.costPerHour <= ch.maxCostPerHour;
    if (ch.maxP99Ms != null) earned &&= m.p99 <= ch.maxP99Ms;
    if (ch.maxComponents != null) earned &&= comps <= ch.maxComponents;
    if (ch.requireSecure) earned &&= security === 100;
    if (ch.survivesMultiplier != null) {
      const r = runOnce(graph, level, seed ^ 0x7a11, ch.survivesMultiplier);
      earned &&= !!r && r.metrics.availability >= 0.95;
    }
    stars.push({ id: ch.id, label: ch.label, hint: ch.hint, earned });
  }
  return stars;
}

const pretty = (t: string) => t.replace(/-/g, " ");

/** Does an observed run clear a threshold gate? Only enforces metrics the engine
    measures today (avail, p99, errorRate, cost); p95/throughput are TODO. */
function meets(m: Metrics, t: Thresholds): boolean {
  const errorRate = 1 - m.availability;
  return (
    (t.availability == null || m.availability >= t.availability) &&
    (t.p99LatencyMs == null || m.p99 <= t.p99LatencyMs) &&
    (t.maxErrorRate == null || errorRate <= t.maxErrorRate) &&
    (t.maxCostPerHour == null || m.costPerHour <= t.maxCostPerHour) &&
    (t.minThroughputRps == null || m.throughput >= t.minThroughputRps)
  );
}

const EMPTY_METRICS: Metrics = { p99: 0, p50: 0, availability: 0, costPerHour: 0, throughput: 0 };

/** Run each tier-2 scenario gate (PRD §7.1): re-run the sim under the scenario's
    traffic shape and check mustMeet. Deterministic (seed derived per scenario). */
function runScenarios(graph: Graph, level: Level, seed: number): ScenarioResult[] {
  return (level.winConditions.scenarios ?? []).map((s, i) => {
    const mult = s.trafficMultiplier ?? 1;
    const run = runOnce(graph, level, seed ^ (0x51e1 + i * 0x1000), mult);
    const metrics = run?.metrics ?? EMPTY_METRICS;
    return { name: s.name, trafficMultiplier: s.trafficMultiplier, passed: run ? meets(metrics, s.mustMeet) : false, metrics, mustMeet: s.mustMeet };
  });
}

/* Fan-out trap: a non-network node wired straight to 2+ replicas of the SAME type
   sends every request to ALL of them (routeNext fans out; only network nodes split
   load). If one such replica is saturated, the player meant to share load but isn't.
   Returns the offending {parent, child} types so the lesson can name them. */
function detectFanout(graph: Graph, base: RunOnce): { parent: string; child: string } | null {
  const idx = indexGraph(graph);
  const utilById = new Map(base.nodes.map((n) => [n.id, n.util] as const));
  for (const n of graph.nodes) {
    const m = modelOf(n.type);
    if (!m || m.kind === "source" || m.kind === "network") continue;
    const succ = idx.successors(n.id);
    const types = succ.map((s) => s.type);
    for (const s of succ) {
      const duplicated = types.indexOf(s.type) !== types.lastIndexOf(s.type);
      if (duplicated && (utilById.get(s.id) ?? 0) >= 0.8) return { parent: n.type, child: s.type };
    }
  }
  return null;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export interface Score {
  dims: Dimensions;
  activeDimensions: DimensionKey[];
  final: number;
  passed: boolean;
  lesson: string;
  scenarios: ScenarioResult[];
  stars: StarResult[];
}

/** Grade a run on five outcome dimensions (never on which components are present).
    Enforces the `steady` (tier-1) gates today; `scenarios`/`resilience` gates
    (PRD §7.1 tiers 2–3) are declared in the DSL but not yet run here — TODO: iterate
    them once the engine exposes p95/throughput at the metrics level. */
export function score(graph: Graph, base: RunOnce, level: Level, seed: number): Score {
  const w = level.winConditions.steady;
  const m = base.metrics;
  const errorRate = 1 - m.availability;

  // Tier-2 scenario gates (visible in the UI). Run them once, reuse for scalability + pass.
  const scenarios = runScenarios(graph, level, seed);
  const spikes = scenarios.filter((s) => (s.trafficMultiplier ?? 1) > 1);

  // Latency target: prefer p99 gate, fall back to p95. Absent ⇒ not graded (full marks).
  const latencyTarget = w.p99LatencyMs ?? w.p95LatencyMs;
  const performance = latencyTarget ? clamp(Math.round(100 * Math.min(1, latencyTarget / Math.max(1, m.p99)))) : 100;
  const reliability = w.availability ? clamp(Math.round(100 * Math.min(1, m.availability / w.availability))) : 100;

  // Scalability: driven only by the level's spike scenario(s) — the same run the
  // player sees as a win-condition row. A level WITHOUT a spike does not test
  // scalability, so it is excluded from the score (no hidden, un-budgetable burst).
  const scalability = spikes.length ? clamp(Math.round(100 * Math.min(...spikes.map((s) => s.metrics.availability)))) : 0;

  // Cost: over-budget designs scale down — punishes over-provisioning.
  const cost = w.maxCostPerHour
    ? clamp(Math.round(m.costPerHour <= w.maxCostPerHour ? 100 : (100 * w.maxCostPerHour) / m.costPerHour))
    : 100;

  // Security / layering: a storage node reachable directly from a source is exposed → 0.
  // When the level requires an app tier, the API Gateway reaching storage directly is
  // also a violation — the gateway is ingress; a Backend must sit between it and data.
  const typeOf = (id: string) => graph.nodes.find((n) => n.id === id)?.type ?? "";
  const exposed = graph.edges.some((e) => modelOf(typeOf(e.source))?.kind === "source" && modelOf(typeOf(e.target))?.kind === "storage");
  const skipsAppTier =
    !!level.requireAppTier &&
    graph.edges.some((e) => typeOf(e.source) === "api-gateway" && modelOf(typeOf(e.target))?.kind === "storage");
  // Cache-aside: writes must not tunnel through a read cache. Uses the observed per-edge
  // flow — any write arriving at a cache/CDN node means the design isn't branching.
  const writesThroughCache =
    !!level.requireWriteSplit &&
    base.edgeFlows.some((f) => f.writes > 0 && (typeOf(f.target) === "cache" || typeOf(f.target) === "cdn"));
  // Attack traffic (levels with traffic.maliciousRatio): graded on the observed share
  // BLOCKED at the edge, not on owning a WAF. Unfiltered flood → breach.
  const attack = base.attack;
  const underAttack = attack.total > 0 && attack.blocked / attack.total < 0.7;
  const security = exposed || skipsAppTier || writesThroughCache || underAttack ? 0 : 100;

  // Honest score: only the dimensions this level actually tests are averaged in.
  const dims: Dimensions = { performance, reliability, scalability, cost, security };
  const activeDimensions: DimensionKey[] = [];
  if (latencyTarget != null) activeDimensions.push("performance");
  if (w.availability != null) activeDimensions.push("reliability");
  if (spikes.length) activeDimensions.push("scalability");
  if (w.maxCostPerHour != null) activeDimensions.push("cost");
  activeDimensions.push("security"); // every architecture is graded on not exposing data
  const final = Math.round(activeDimensions.reduce((s, k) => s + dims[k], 0) / activeDimensions.length);

  // Pass = clear every steady gate the level set (absent = not enforced) AND every scenario gate.
  const steadyPass =
    (w.availability == null || m.availability >= w.availability) &&
    (w.p99LatencyMs == null || m.p99 <= w.p99LatencyMs) &&
    (w.maxCostPerHour == null || m.costPerHour <= w.maxCostPerHour) &&
    (w.maxErrorRate == null || errorRate <= w.maxErrorRate) &&
    (w.minThroughputRps == null || m.throughput >= w.minThroughputRps) &&
    security === 100;
  const passed = steadyPass && scenarios.every((s) => s.passed);

  const hasStorage = graph.nodes.some((n) => modelOf(n.type)?.kind === "storage");
  const fanout = detectFanout(graph, base);

  // A node-down outage this design has no standby for: adding capacity can't help, so
  // steer the player toward redundancy instead of the generic "add capacity" lesson.
  const outage = (level.failureInjections ?? []).find((f) => f.kind === "node-down");
  const outageType = outage && outage.kind === "node-down" ? outage.nodeType : null;
  const hasStandby = graph.nodes.some((n) => modelOf(n.type)?.standby);

  let lesson = "";
  if (exposed)
    lesson = "Your Database is exposed directly to the Client. Apps should talk through an API layer — add an API between them.";
  else if (skipsAppTier)
    lesson = "Your API Gateway talks straight to the database. The gateway is your edge — routing and auth, not business logic. Put a Backend (app tier) between the gateway and the data.";
  else if (writesThroughCache)
    lesson = "Your writes are flowing through the read cache. A cache can't store a write — route writes straight to the datastore and let the cache serve only reads (send one edge to the cache, another to the DB).";
  else if (underAttack)
    lesson = `${Math.round((1 - attack.blocked / attack.total) * 100)}% of the attack traffic sailed straight past your edge — bots don't hit caches, so every junk request burned origin capacity your real users paid for. Filter it at the front door: a WAF (deep inspection) or a Rate Limiter (volumetric).`;
  else if (!hasStorage)
    lesson = "Requests have nowhere to be stored or served from — add a database so the data actually persists.";
  else if (fanout)
    lesson = `Your ${pretty(fanout.parent)} sends every request to all its targets, so each ${pretty(fanout.child)} replica receives the full load instead of a share — and it saturated. Put a Load Balancer in front to split traffic across the replicas.`;
  else if (outageType && !hasStandby && reliability < 90)
    lesson = `Your ${pretty(outageType)} is a single point of failure — when it went down, every request went down with it. Adding capacity can't save a dead node; wire in a hot standby so a backup takes over during the outage.`;
  else if (reliability < 90 || performance < 90)
    lesson = `A node saturated under load — p99 hit ${m.p99}ms, availability ${(m.availability * 100).toFixed(1)}%. Add capacity or a faster path (a cache?).`;
  else if (spikes.some((s) => !s.passed))
    lesson = `Holds at normal load but fails the ${pretty(spikes.find((s) => !s.passed)!.name)} (${spikes.find((s) => !s.passed)!.trafficMultiplier}× traffic). Scale the front-door tier so it survives the spike.`;
  else if (cost < 90) lesson = "Over budget — over-provisioned. The right-sized design beats the over-built one.";
  else if (passed) lesson = "Solid. The system handles the load with headroom.";

  const stars = computeStars(graph, level, m, security, passed, seed);
  return { dims, activeDimensions, final, passed, lesson, scenarios, stars };
}
