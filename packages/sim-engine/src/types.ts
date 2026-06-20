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
  /** cache hit ratio 0..1 for storage caches. TODO: drive hit/miss in workload.ts */
  hitRatio?: number;
  /** max queued requests before load-shedding. TODO: backpressure in queue.ts */
  queueLimit?: number;
}

/** A submitted architecture: a typed graph (PRD §5.2). */
export interface GraphNode {
  id: string;
  type: string;
  /** per-node overrides (e.g. instances) set by the player. TODO: read in sim */
  config?: { instances?: number };
}
export interface GraphEdge {
  source: string;
  target: string;
  /** network latency added crossing this edge. TODO: add to request time */
  latencyMs?: number;
}
export interface Graph { nodes: GraphNode[]; edges: GraphEdge[] }

export interface Traffic { profile: string; ratePerMin: number; readWriteRatio: number }
export interface WinConditions { p99LatencyMs: number; availability: number; maxCostPerHour: number }

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
  failureInjections: FailureInjection[];
  winConditions: WinConditions;
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

export interface Metrics { p99: number; p50: number; availability: number; costPerHour: number }

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

export interface SimResult {
  ok: boolean;
  error?: string;
  metrics: Metrics;
  nodes: SimNodeResult[];
  events: SimEvent[];
  dims: Dimensions;
  final: number;
  passed: boolean;
  lesson: string;
}
