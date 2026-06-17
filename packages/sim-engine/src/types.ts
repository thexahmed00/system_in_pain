/* =========================================================================
   @sdq/sim-engine — public types
   Framework-free. Shared by the client and (later) the Nest backend, which
   re-runs the SAME engine to verify scores (PRD §5.4).
   ========================================================================= */

export type Kind = "source" | "compute" | "storage" | "network" | "messaging" | "security";

/** Pure component physics — no presentation (icons/labels live in the UI). */
export interface ComponentModel {
  type: string;
  kind: Kind;
  cap: number;     // req/s capacity (display/future; not yet used by the model)
  baseMs: number;  // base service latency
  cost: number;    // $/hr per instance
}

/** A submitted architecture: a typed graph (PRD §5.2). */
export interface GraphNode { id: string; type: string }
export interface GraphEdge { source: string; target: string }
export interface Graph { nodes: GraphNode[]; edges: GraphEdge[] }

export interface Traffic { profile: string; ratePerMin: number; readWriteRatio: number }
export interface WinConditions { p99LatencyMs: number; availability: number; maxCostPerHour: number }

/** Level DSL (PRD §7 / VISION). Validated by levels/schema.ts. */
export interface Level {
  id: string;
  stage: number;
  title: string;
  story: string;
  traffic: Traffic;
  allowedComponents: string[];
  failureInjections: unknown[];
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
export interface SimNodeResult { id: string; util: number; status: Status }
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
