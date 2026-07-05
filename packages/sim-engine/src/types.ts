/* =========================================================================
   @sdq/sim-engine — public types
   Framework-free. Shared by the client and (later) the Nest backend, which
   re-runs the SAME engine to verify scores (PRD §5.4).

   v1 fields are in use today. Fields/types marked TODO are scaffolding for the
   fuller model (instances/M·M·c, caching, fan-out, failure injection, network
   latency) — declared now so the shape is stable; math lands incrementally.
   ========================================================================= */

export type Kind = "source" | "compute" | "storage" | "network" | "messaging" | "security";

/** Pure component physics — no presentation (icons/labels live in the UI). */
export interface ComponentModel {
  type: string;
  kind: Kind;
  cap: number;     // req/s capacity — TODO: enforce as a real throughput ceiling (currently display-only)
  baseMs: number;  // base service latency
  cost: number;    // $/hr per instance

  // --- scaling scaffold ---
  /** parallel servers (M/M/c). Defaults to 1 when absent. TODO: use in queue.ts */
  instances?: number;
  /** max replicas of a single node (vertical limit). Beyond this you must scale
      horizontally — a Load Balancer in front of multiple nodes. */
  maxInstances?: number;
  /** cache hit ratio 0..1 for read-caches (Redis, CDN). Reads can hit; writes fall through. */
  hitRatio?: number;
  /** max queued requests before load-shedding. TODO: backpressure in queue.ts */
  queueLimit?: number;

  // --- replication scaffold (PRD stage 3–4: replicas / failover) ---
  /** serves reads only; writes must go to a primary. TODO: route by RequestClass in workload.ts */
  readOnly?: boolean;
  /** staleness window — writes take this long to appear on a replica. Drives the
      emergent REPLICATION LAG failure. TODO: apply to read-after-write in sim */
  replicaLagMs?: number;
  /** hot standby that takes over when its primary fails — removes the SPOF a lone
      DB creates under a `kill-node` resilience gate. Failover is not free: traffic
      shifts only after a detection window (simulate.ts FAILOVER_DETECT_SEC). */
  standby?: boolean;
  /** security nodes only: fraction of malicious requests this node blocks (0..1).
      Legit traffic always passes through (paying the node's latency + capacity). */
  filterRatio?: number;
}

/** A submitted architecture: a typed graph (PRD §5.2). */
export interface GraphNode {
  id: string;
  type: string;
  /** per-node overrides (e.g. instances) set by the player. TODO: read in sim */
  config?: { instances?: number };
  /** canvas layout hint for level starter graphs — ignored by the sim */
  position?: { x: number; y: number };
}
export interface GraphEdge {
  source: string;
  target: string;
  /** network latency added crossing this edge. TODO: add to request time */
  latencyMs?: number;
}
export interface Graph { nodes: GraphNode[]; edges: GraphEdge[] }

export interface Traffic {
  profile: string;
  ratePerMin: number;
  readWriteRatio: number;
  /** fraction of arrivals that are attack traffic (bots/scrapers/floods), 0 when absent.
      Malicious requests consume capacity like real ones but never cache-hit; only a
      security node (WAF / Rate Limiter) blocks them. Availability counts legit users only;
      an unfiltered attack zeroes the Security dimension. */
  maliciousRatio?: number;
}

/* Win conditions — three gate tiers (PRD §7.1). A submission passes only if it
   clears every gate. All threshold fields optional: a level sets only what it tests. */
export interface Thresholds {
  minThroughputRps?: number; // throughputRps ≥ value — anti silent-drop
  maxErrorRate?: number;     // observed 5xx rate ≤ value (0..1)
  p95LatencyMs?: number;     // p95 ≤ value
  p99LatencyMs?: number;     // p99 ≤ value
  availability?: number;     // ≥ value (0..1)
  maxCostPerHour?: number;   // ≤ value
  maxRecoveryMs?: number;    // resilience only — time to recover after a fault
}
/** Re-run the sim under a different traffic shape (PRD §7.1 tier 2). */
export interface ScenarioGate { name: string; trafficMultiplier?: number; profile?: string; mustMeet: Thresholds }
/** Re-run the sim with a fault injected; design must still meet mustMeet (tier 3). */
export interface ResilienceGate { inject: string; mustMeet: Thresholds }
export interface WinConditions {
  steady: Thresholds;          // tier 1 — base-load gates (single nominal run)
  scenarios: ScenarioGate[];   // tier 2 — named traffic events
  resilience: ResilienceGate[];// tier 3 — failure injection
}
/** Tighter threshold sets layered on a Bronze pass (PRD §7.4). */
export interface Medals { silver?: Thresholds; gold?: Thresholds; platinum?: Thresholds }

/** An optional per-level mastery goal beyond passing. Earned only if the level is
    also solved. 3 stars per level = Solved + two of these. */
export interface Challenge {
  id: string;
  label: string;
  hint: string;
  maxCostPerHour?: number;     // costPerHour ≤ value
  maxP99Ms?: number;           // p99 ≤ value
  maxComponents?: number;      // non-source node count ≤ value (minimalism)
  survivesMultiplier?: number; // availability ≥ 0.95 when re-run at N× traffic
  requireSecure?: boolean;     // security dimension == 100
}
export interface StarResult { id: string; label: string; hint: string; earned: boolean }

/** A request is a read or a write — they hit caches/DBs differently. TODO: classify per arrival */
export type RequestClass = "read" | "write";

/** Scenario stressors (PRD §5 / VISION failure simulation). Each lasts durationSec, then recovers. */
export type FailureInjection =
  | { kind: "spike"; atSecond: number; durationSec: number; multiplier: number }    // traffic surge window
  | { kind: "node-down"; atSecond: number; durationSec: number; nodeType: string }  // all nodes of a type fail
  | { kind: "latency-spike"; atSecond: number; durationSec: number; addMs: number };// network degradation window

/** Level DSL (PRD §7 / VISION). Validated by levels/schema.ts. */
export interface Level {
  id: string;
  stage: number;
  title: string;
  story: string;
  traffic: Traffic;
  allowedComponents: string[];
  /** Internal sim fault mechanism. The level DSL expresses faults via
      winConditions.resilience; a resilience→injection compiler will populate this
      (TODO). Optional/legacy — simulate.ts reads `?? []`. */
  failureInjections?: FailureInjection[];
  winConditions: WinConditions;
  medals?: Medals;
  /** Up to two optional mastery goals; with "Solved" they make 3 stars. */
  challenges?: Challenge[];
  /** Separation of concerns: when true, the API Gateway is ingress only — wiring it
      (or the Client) straight to storage is a layering violation. The app tier
      (a Backend) must sit between the gateway and the data. Off by default so early
      levels keep their single-compute-tier solutions. */
  requireAppTier?: boolean;
  /** Cache-aside correctness: when true, writes must not flow through a read cache —
      reads go to the cache, writes go straight to the datastore (the branched pattern).
      Checked against the per-edge flow, so it needs the split routing to be meaningful. */
  requireWriteSplit?: boolean;
  /** Pre-built architecture the level opens with (instead of a lone Client). Lets a
      level start over-engineered so the player's job is SUBTRACTING — a different
      gameplay verb from the usual build-up. Node positions are canvas hints. */
  starterGraph?: Graph;
  concepts: string[];
}

export type Status = "healthy" | "load" | "bottleneck" | "fail";

/** Ordered simulation event (PRD §5.3) — drives animation + AI mentor. */
export type SimEventType = "saturation" | "timeout";
export interface SimEvent {
  t: number;       // seconds into the run
  node: string;
  type: SimEventType;
  util?: number;
}

export interface Metrics { p99: number; p50: number; availability: number; costPerHour: number; throughput: number }

/** Reads vs writes that traversed one edge over the run — drives the flow animation. */
export interface SimEdgeFlow { source: string; target: string; reads: number; writes: number }

export interface SimNodeResult {
  id: string;
  util: number;
  status: Status;
  // --- richer per-node outputs (TODO: populate in simulate.ts) ---
  throughput?: number;  // requests served per second
  dropRate?: number;    // fraction dropped at this node
  backlog?: number;     // peak queue length
  p99?: number;         // per-node tail latency
}

export interface Dimensions {
  performance: number;
  reliability: number;
  scalability: number;
  cost: number;
  security: number;
}
export type DimensionKey = keyof Dimensions;

/** Outcome of one tier-2 scenario gate (PRD §7.1) — a visible re-run under a
    different traffic shape. Surfaced so the UI can show it as a win-condition row. */
export interface ScenarioResult {
  name: string;
  trafficMultiplier?: number;
  passed: boolean;
  metrics: Metrics;     // observed under the scenario
  mustMeet: Thresholds; // the gate it had to clear
}

export interface SimResult {
  ok: boolean;
  error?: string;
  metrics: Metrics;
  nodes: SimNodeResult[];
  events: SimEvent[];
  dims: Dimensions;
  /** Which dimensions this level actually tests — the only ones averaged into `final`.
      The UI greys the rest. (scalability is active only when a spike scenario exists.) */
  activeDimensions: DimensionKey[];
  final: number;
  passed: boolean;
  lesson: string;
  scenarios: ScenarioResult[];
  stars: StarResult[];
  /** Per-edge read/write counts from the base run — for the flow animation. */
  edgeFlows: SimEdgeFlow[];
}
