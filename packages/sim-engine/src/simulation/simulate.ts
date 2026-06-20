import type { Graph, GraphNode, Level, Metrics, RequestClass, SimEvent, SimNodeResult, Status } from "../types";
import { createRng, exp, type Rng } from "../rng/mulberry32";
import { modelOf } from "../components/models";
import { indexGraph } from "./graph";
import { NodeQueue } from "./queue";
import { classifyRequest, cacheHit } from "./workload";
import { trafficMultiplierAt, isTypeDownAt, extraLatencyMsAt } from "../failures/inject";
import { MinHeap } from "../lib/heap";

const DURATION = 60; // seconds simulated
const TIMEOUT_MS = 1000; // a request slower than this fails
const MAX_EVENTS = 200;
const DEFAULT_QUEUE_LIMIT = 1_000_000; // effectively unbounded; timeout sheds load
const DEFAULT_CACHE_HIT = 0.8;

export interface RunOnce {
  total: number;
  success: number;
  metrics: Metrics;
  nodes: SimNodeResult[];
  events: SimEvent[];
}

interface Job {
  cls: RequestClass;
  start: number;
  live: number; // in-flight branches; request completes when this hits 0
  maxFinish: number; // critical-path end time (slowest branch)
  anyDrop: boolean;
  reachedStorage: boolean; // did the request actually reach a datastore? (no store → not served)
}

type EventBody =
  | { t: number; kind: "arrival"; cls: RequestClass }
  | { t: number; kind: "enter"; node: GraphNode; job: Job }
  | { t: number; kind: "finish"; node: GraphNode; job: Job; svc: number };
type Event = EventBody & { seq: number };

function statusFor(util: number): Status {
  if (util >= 1) return "fail";
  if (util >= 0.8) return "bottleneck";
  if (util >= 0.5) return "load";
  return "healthy";
}

const serversOf = (n: GraphNode): number => n.config?.instances ?? modelOf(n.type)?.instances ?? 1;
const queueLimitOf = (n: GraphNode): number => modelOf(n.type)?.queueLimit ?? DEFAULT_QUEUE_LIMIT;

export function runOnce(graph: Graph, level: Level, seed: number, mult: number): RunOnce | null {
  const idx = indexGraph(graph);
  if (idx.sources.length === 0) return null;
  if (!idx.sources.some((s) => idx.successors(s.id).length > 0)) return null; // nothing to route into

  const rng = createRng(seed);
  const injections = level.failureInjections ?? [];

  // per-node service counters (skip sources — clients don't queue)
  const queues = new Map<string, NodeQueue<Job>>();
  const firstQueuedAt = new Map<string, number>();
  for (const n of graph.nodes) {
    if (modelOf(n.type)?.kind === "source") continue;
    queues.set(n.id, new NodeQueue<Job>(serversOf(n), queueLimitOf(n)));
  }

  // edge latency lookup (ms), default 0
  const edgeMs = new Map<string, number>();
  for (const e of graph.edges) edgeMs.set(`${e.source}->${e.target}`, e.latencyMs ?? 0);
  const hopSec = (from: string, to: string, t: number) =>
    ((edgeMs.get(`${from}->${to}`) ?? 0) + extraLatencyMsAt(injections, t)) / 1000;

  // round-robin counters for load balancers
  const rr = new Map<string, number>();

  // ---- event queue ----
  let seq = 0;
  const heap = new MinHeap<Event>((a, b) => a.t < b.t || (a.t === b.t && a.seq < b.seq));
  const schedule = (e: EventBody) => heap.push({ ...e, seq: seq++ });

  // ---- arrivals: time-varying Poisson via thinning (heavier during spikes) ----
  const baseRate = (level.traffic.ratePerMin / 60) * mult;
  const maxSpike = injections.reduce((mx, f) => (f.kind === "spike" ? Math.max(mx, f.multiplier) : mx), 1);
  const lambdaMax = baseRate * maxSpike;
  let total = 0;
  {
    let t = 0;
    while ((t += exp(rng, 1 / lambdaMax)) <= DURATION) {
      const accept = rng() < (baseRate * trafficMultiplierAt(injections, t)) / lambdaMax;
      if (!accept) continue;
      const cls = classifyRequest(rng, level.traffic.readWriteRatio);
      schedule({ t, kind: "arrival", cls });
      total++;
    }
  }

  // ---- results accumulation ----
  const latencies: number[] = [];
  let success = 0;
  const timeoutEvents: SimEvent[] = [];

  const serviceSec = (n: GraphNode): number => {
    const base = (modelOf(n.type)!.baseMs) / 1000;
    return base * 0.8 + exp(rng, base * 0.2);
  };

  // where does a finished job at `node` go next? ([] = this branch ends here)
  const routeNext = (node: GraphNode, job: Job): GraphNode[] => {
    const succ = idx.successors(node.id);
    if (succ.length === 0) return [];
    const m = modelOf(node.type)!;
    if (m.kind === "network") {
      const c = rr.get(node.id) ?? 0; // load balancer: pick ONE target
      rr.set(node.id, c + 1);
      return [succ[c % succ.length]];
    }
    if (node.type === "cache") {
      const hit = cacheHit(rng, m.hitRatio ?? DEFAULT_CACHE_HIT, job.cls);
      return hit ? [] : succ; // hit → served here; miss/write → fall through to storage
    }
    return succ; // fan-out to all targets
  };

  const completeRequest = (job: Job) => {
    const latencyMs = (job.maxFinish - job.start) * 1000;
    if (!job.anyDrop && latencyMs <= TIMEOUT_MS && job.reachedStorage) {
      success++;
      latencies.push(latencyMs);
    }
  };
  const endLeg = (job: Job, t: number) => {
    if (t > job.maxFinish) job.maxFinish = t;
    if (--job.live === 0) completeRequest(job);
  };
  const forward = (from: GraphNode, job: Job, t: number) => {
    for (const n of routeNext(from, job)) {
      job.live++;
      schedule({ t: t + hopSec(from.id, n.id, t), kind: "enter", node: n, job });
    }
  };
  const startService = (node: GraphNode, job: Job, t: number) => {
    const svc = serviceSec(node);
    schedule({ t: t + svc, kind: "finish", node, job, svc });
  };

  // ---- process events in time order ----
  const source = idx.sources[0];
  while (heap.size > 0) {
    const ev = heap.pop()!;
    const t = ev.t;
    if (ev.kind === "arrival") {
      const job: Job = { cls: ev.cls, start: t, live: 1, maxFinish: t, anyDrop: false, reachedStorage: false };
      forward(source, job, t); // client emits into the system
      endLeg(job, t); // consume the initial leg
    } else if (ev.kind === "enter") {
      const { node, job } = ev;
      if (isTypeDownAt(injections, node.type, t)) {
        job.anyDrop = true; // box is crashed → turned away
        endLeg(job, t);
        continue;
      }
      const q = queues.get(node.id)!;
      const adm = q.arrive(job);
      if (adm === "serve") startService(node, job, t);
      else if (adm === "queued") {
        if (!firstQueuedAt.has(node.id)) firstQueuedAt.set(node.id, t);
      } else {
        job.anyDrop = true; // line full → dropped
        if (timeoutEvents.length < MAX_EVENTS) timeoutEvents.push({ t: round2(t), node: node.id, type: "timeout" });
        endLeg(job, t);
      }
    } else {
      // finish
      const { node, job, svc } = ev;
      if (modelOf(node.type)?.kind === "storage") job.reachedStorage = true; // data was stored/served
      const q = queues.get(node.id)!;
      const next = q.finish(svc); // free worker; maybe pull a waiting job
      if (next) startService(node, next, t);
      forward(node, job, t); // send finished job onward (or end branch)
      endLeg(job, t); // consume current branch
    }
  }

  // ---- per-node metrics ----
  const nodes: SimNodeResult[] = [];
  for (const n of graph.nodes) {
    if (modelOf(n.type)?.kind === "source") continue;
    const q = queues.get(n.id)!;
    const servers = serversOf(n);
    const util = q.busyTimeSec / (DURATION * servers);
    const handled = q.served + q.dropped;
    nodes.push({
      id: n.id,
      util,
      status: statusFor(util),
      throughput: q.served / DURATION,
      dropRate: handled ? q.dropped / handled : 0,
      backlog: q.peakBacklog,
    });
  }

  latencies.sort((x, y) => x - y);
  const pct = (qv: number) =>
    latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(qv * latencies.length))] : TIMEOUT_MS;
  const cost = graph.nodes.reduce((c, n) => {
    const m = modelOf(n.type);
    return m && m.kind !== "source" ? c + m.cost * serversOf(n) : c;
  }, 0);

  const saturationEvents: SimEvent[] = nodes
    .filter((n) => n.util >= 0.8)
    .map((n) => ({ t: round2(firstQueuedAt.get(n.id) ?? 0), node: n.id, type: "saturation", util: n.util }));
  const events = [...saturationEvents, ...timeoutEvents].sort((a, b) => a.t - b.t).slice(0, MAX_EVENTS);

  return {
    total,
    success,
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
