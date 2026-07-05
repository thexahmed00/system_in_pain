import type { Graph, GraphNode, Level, Metrics, RequestClass, SimEdgeFlow, SimEvent, SimNodeResult, Status } from "../types";
import { createRng, exp, type Rng } from "../rng/mulberry32";
import { modelOf } from "../components/models";
import { indexGraph } from "./graph";
import { NodeQueue } from "./queue";
import { classifyRequest, cacheHit } from "./workload";
import { trafficMultiplierAt, isTypeDownAt, downSinceAt, extraLatencyMsAt } from "../failures/inject";
import { MinHeap } from "../lib/heap";

const DURATION = 60; // seconds simulated
const TIMEOUT_MS = 1000; // a request slower than this fails
const MAX_EVENTS = 200;
const DEFAULT_QUEUE_LIMIT = 1_000_000; // effectively unbounded; timeout sheds load
const DEFAULT_CACHE_HIT = 0.8;
// Failover isn't free: an outage must persist this long before traffic shifts to a
// standby (detection + promotion). The requests in that window are the price of
// not having faster health checks.
const FAILOVER_DETECT_SEC = 2;

export interface RunOnce {
  total: number;
  success: number;
  metrics: Metrics;
  nodes: SimNodeResult[];
  events: SimEvent[];
  edgeFlows: SimEdgeFlow[];
  /** attack-traffic tally (all zero when the level has no maliciousRatio).
      blocked = stopped by a security node; served = reached a datastore. */
  attack: { total: number; blocked: number; served: number };
}

interface Job {
  cls: RequestClass;
  start: number;
  live: number; // in-flight branches; request completes when this hits 0
  maxFinish: number; // critical-path end time (slowest branch)
  anyDrop: boolean;
  reachedStorage: boolean; // did the request actually reach a datastore? (no store → not served)
  detached?: boolean; // an async write being drained from a queue to storage (off the client's path)
  malicious?: boolean; // attack traffic — consumes capacity but never counts as a user
  blocked?: boolean; // a security node stopped this (malicious) request
}

type EventBody =
  | { t: number; kind: "arrival"; cls: RequestClass; malicious: boolean }
  | { t: number; kind: "enter"; node: GraphNode; job: Job }
  | { t: number; kind: "finish"; node: GraphNode; job: Job; svc: number };
type Event = EventBody & { seq: number };

function statusFor(util: number): Status {
  if (util >= 1) return "fail";
  if (util >= 0.8) return "bottleneck";
  if (util >= 0.5) return "load";
  return "healthy";
}

/** Player-set replica multiplier (drives cost + multiplies concurrency). Clamped to the
    component's maxInstances here — the UI stepper enforces this too, but a submitted
    graph is untrusted (PRD §5.4: the backend re-runs this exact engine to verify a
    score), so the ceiling has to hold at the source, not just in the client widget. */
const instancesOf = (n: GraphNode): number => {
  const requested = n.config?.instances ?? 1;
  const max = modelOf(n.type)?.maxInstances;
  return max ? Math.min(requested, max) : requested;
};

/** Concurrent workers (M/M/c). Derived from the advertised cap via Little's law
    (concurrency = throughput × latency), so the r/s shown on the node IS the
    throughput the sim delivers. Multiplied by the player's replica count. */
const serversOf = (n: GraphNode): number => {
  const m = modelOf(n.type);
  if (!m) return 1;
  const base = m.instances ?? (m.cap === Infinity ? 1 : Math.max(1, Math.round((m.cap * m.baseMs) / 1000)));
  return base * instancesOf(n);
};
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
  const maliciousRatio = level.traffic.maliciousRatio ?? 0;
  let total = 0;
  const attack = { total: 0, blocked: 0, served: 0 };
  {
    let t = 0;
    while ((t += exp(rng, 1 / lambdaMax)) <= DURATION) {
      const accept = rng() < (baseRate * trafficMultiplierAt(injections, t)) / lambdaMax;
      if (!accept) continue;
      const cls = classifyRequest(rng, level.traffic.readWriteRatio);
      // short-circuit keeps the rng stream identical for levels without an attack
      const malicious = maliciousRatio > 0 && rng() < maliciousRatio;
      if (malicious) attack.total++;
      schedule({ t, kind: "arrival", cls, malicious });
      total++;
    }
  }

  // ---- results accumulation ----
  const latencies: number[] = [];
  let success = 0;
  let writeLoss = 0; // async writes acked by a queue but dropped before reaching storage
  const timeoutEvents: SimEvent[] = [];

  // per-edge read/write tally (drives the flow animation on the client)
  const edgeFlow = new Map<string, { reads: number; writes: number }>();
  const tallyEdge = (from: string, to: string, cls: RequestClass) => {
    const key = `${from}->${to}`;
    const f = edgeFlow.get(key) ?? { reads: 0, writes: 0 };
    if (cls === "read") f.reads++;
    else f.writes++;
    edgeFlow.set(key, f);
  };

  // Service time: 70% fixed + 30% exponential jitter (mean = baseMs). The variance
  // matters pedagogically: it makes p99 climb visibly as a node approaches its cap
  // instead of staying flat until a knife-edge collapse at exactly ρ = 1.
  const serviceSec = (n: GraphNode): number => {
    const base = (modelOf(n.type)!.baseMs) / 1000;
    return base * 0.7 + exp(rng, base * 0.3);
  };

  // where does a finished job at `node` go next? ([] = this branch ends here)
  const routeNext = (node: GraphNode, job: Job, t: number): GraphNode[] => {
    let succ = idx.successors(node.id);
    const m = modelOf(node.type)!;

    // cache + CDN can resolve WITHOUT any downstream wiring — a hit is served locally
    // regardless of what's connected behind it, so this check runs before the "nothing
    // downstream" bail below. Malicious traffic never hits (bots request uncacheable
    // junk) — that's exactly why an unfiltered flood reaches the origin even behind a
    // healthy cache. (CDN is an edge read-cache; Redis is a near-origin read-cache.)
    if (node.type === "cache" || node.type === "cdn") {
      const hit = !job.malicious && cacheHit(rng, m.hitRatio ?? DEFAULT_CACHE_HIT, job.cls);
      if (hit) {
        job.reachedStorage = true;
        return []; // served here — done, no forwarding needed
      }
      return succ; // miss/write falls through — [] here means a dangling cache/CDN
      // (nothing wired behind it), which correctly stays unresolved and fails.
    }

    if (succ.length === 0) return [];

    // Failover: when a hot standby backs up a primary among the targets, traffic goes
    // to the primary normally and to the standby ONLY once the primary's outage has
    // persisted past the detection window — the requests inside that window are lost.
    // A standby costs money continuously but rescues an outage — unlike a naive
    // fan-out to both, which would double the steady-state load.
    const standbys = succ.filter((s) => modelOf(s.type)?.standby);
    if (standbys.length) {
      const primaries = succ.filter((s) => !modelOf(s.type)?.standby);
      let failedOver = primaries.length === 0;
      if (!failedOver && primaries.every((p) => isTypeDownAt(injections, p.type, t))) {
        const since = Math.max(...primaries.map((p) => downSinceAt(injections, p.type, t) ?? t));
        failedOver = t >= since + FAILOVER_DETECT_SEC;
      }
      succ = failedOver ? standbys : primaries;
    }

    // Request-class routing: when a node forwards to BOTH a read path (cache / CDN /
    // read-replica) AND another branch, reads take the read path and writes avoid it.
    // Symmetrically, a queue among the branches is a WRITE path: writes take it, reads
    // avoid it — so `api → {db, queue→db}` is the reference async-write split. With only
    // one kind of successor we keep fan-out, so a linear cache chain (writes fall through
    // the cache to storage) is unchanged.
    if (succ.length > 1) {
      const readPath = succ.filter((s) => s.type === "cache" || s.type === "cdn" || modelOf(s.type)?.readOnly === true);
      const writePath = succ.filter((s) => modelOf(s.type)?.kind === "messaging");
      if (job.cls === "read") {
        if (readPath.length > 0 && readPath.length < succ.length) succ = readPath;
        else if (writePath.length > 0 && writePath.length < succ.length) succ = succ.filter((s) => !writePath.includes(s));
      } else {
        if (writePath.length > 0 && writePath.length < succ.length) succ = writePath;
        else if (readPath.length > 0 && readPath.length < succ.length) succ = succ.filter((s) => !readPath.includes(s));
      }
    }

    if (m.kind === "network") {
      const c = rr.get(node.id) ?? 0; // load balancer: split — pick ONE target
      rr.set(node.id, c + 1);
      return [succ[c % succ.length]];
    }
    return succ; // fan-out to all targets
  };

  const completeRequest = (job: Job) => {
    if (job.detached) return; // async write drain — not a client-visible request
    if (job.malicious) {
      // bots aren't users: they never count toward latency/availability — only
      // toward the attack tally the Security dimension is graded on.
      if (job.blocked) attack.blocked++;
      else if (job.reachedStorage) attack.served++;
      return;
    }
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
    for (const n of routeNext(from, job, t)) {
      job.live++;
      tallyEdge(from.id, n.id, job.cls);
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
      const job: Job = { cls: ev.cls, start: t, live: 1, maxFinish: t, anyDrop: false, reachedStorage: false, malicious: ev.malicious };
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
        if (job.detached) writeLoss++; // an async write was lost before it persisted
        else if (timeoutEvents.length < MAX_EVENTS) timeoutEvents.push({ t: round2(t), node: node.id, type: "timeout" });
        endLeg(job, t);
      }
    } else {
      // finish
      const { node, job, svc } = ev;
      const m = modelOf(node.type);
      // Genuine terminal stores resolve on every finish. Cache is `kind: "storage"` too,
      // but it's a pass-through, not a terminal store — a miss must actually reach real
      // storage downstream, so it's excluded here and marked only on a hit (routeNext).
      if (m?.kind === "storage" && node.type !== "cache") job.reachedStorage = true; // data was stored/served
      const q = queues.get(node.id)!;
      const next = q.finish(svc); // free worker; maybe pull a waiting job
      if (next) startService(node, next, t);

      // Security node (WAF / Rate Limiter): passes legit traffic through, blocks a
      // share of malicious traffic right here — the flood never reaches the origin.
      if (m?.kind === "security" && job.malicious && rng() < (m.filterRatio ?? 0)) {
        job.blocked = true;
        endLeg(job, t);
      }
      // Async write: a durable queue ACKs the write to the client immediately, then
      // drains it to storage on a detached branch that still consumes DB capacity.
      // Spikes are absorbed; sustained write load the DB can't drain → writeLoss.
      else if (m?.kind === "messaging" && job.cls === "write" && !job.detached) {
        job.reachedStorage = true; // accepted into the durable queue (client sees success)
        for (const n of idx.successors(node.id)) {
          const drain: Job = { cls: "write", start: t, live: 1, maxFinish: t, anyDrop: false, reachedStorage: true, detached: true };
          tallyEdge(node.id, n.id, "write");
          schedule({ t: t + hopSec(node.id, n.id, t), kind: "enter", node: n, job: drain });
        }
        endLeg(job, t); // client leg completes at the queue (fast)
      } else {
        forward(node, job, t); // send finished job onward (or end branch)
        endLeg(job, t); // consume current branch
      }
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
    return m && m.kind !== "source" ? c + m.cost * instancesOf(n) : c;
  }, 0);

  const saturationEvents: SimEvent[] = nodes
    .filter((n) => n.util >= 0.8)
    .map((n) => ({ t: round2(firstQueuedAt.get(n.id) ?? 0), node: n.id, type: "saturation", util: n.util }));
  const events = [...saturationEvents, ...timeoutEvents].sort((a, b) => a.t - b.t).slice(0, MAX_EVENTS);

  const edgeFlows: SimEdgeFlow[] = [...edgeFlow.entries()].map(([key, f]) => {
    const [source, target] = key.split("->");
    return { source, target, reads: f.reads, writes: f.writes };
  });

  // Availability is measured over legit users only — an attack degrades it by
  // stealing capacity from them, not by the bots' own "failures".
  const legitTotal = total - attack.total;
  return {
    total,
    success,
    edgeFlows,
    attack,
    metrics: {
      p99: Math.round(pct(0.99)),
      p50: Math.round(pct(0.5)),
      // acked-but-lost async writes count against availability — you can't queue your way
      // out of insufficient DB capacity, only out of a temporary spike.
      availability: legitTotal ? Math.max(0, success - writeLoss) / legitTotal : 0,
      costPerHour: cost,
      throughput: success / DURATION,
    },
    nodes,
    events,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
