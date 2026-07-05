import type { ComponentModel } from "../types";

/* =========================================================================
   Component physics — the single source of truth for the numbers.
   The client's UI catalog (icons/labels/groups) references these models.
   ========================================================================= */
export const COMPONENT_MODELS: Record<string, ComponentModel> = {
  client:          { type: "client",          kind: "source",    cap: Infinity, baseMs: 0,  cost: 0 },
  "api-gateway":   { type: "api-gateway",     kind: "compute",   cap: 500,      baseMs: 20, cost: 2, maxInstances: 4 },
  backend:         { type: "backend",         kind: "compute",   cap: 350,      baseMs: 25, cost: 2, maxInstances: 4 },
  // NoSQL buys 3× the throughput at a premium — otherwise it would strictly dominate
  // SQL and "pick the right datastore" stops being a decision. (The deeper trade-off,
  // consistency/replication lag, lands with the replication scaffold below.)
  "sql-db":        { type: "sql-db",          kind: "storage",   cap: 200,      baseMs: 50, cost: 3, maxInstances: 3 },
  "nosql-db":      { type: "nosql-db",        kind: "storage",   cap: 600,      baseMs: 30, cost: 4, maxInstances: 3 },
  // Replication (PRD stage 3–4). read-replica scales reads but lags writes;
  // db-standby is a hot failover copy that removes the lone-DB SPOF.
  "read-replica":  { type: "read-replica",    kind: "storage",   cap: 200,      baseMs: 55, cost: 3, readOnly: true,  replicaLagMs: 200, maxInstances: 4 },
  "db-standby":    { type: "db-standby",      kind: "storage",   cap: 200,      baseMs: 50, cost: 3, standby: true,    replicaLagMs: 100 },
  cache:           { type: "cache",           kind: "storage",   cap: 5000,     baseMs: 3,  cost: 2, maxInstances: 3 },
  // CDN = edge read-cache (high hit ratio, huge capacity). Load Balancer / Reverse
  // Proxy split traffic across the nodes behind them (round-robin) — but they're not
  // interchangeable: Load Balancer is the managed/premium tier (higher cap, lower
  // latency, costs more); Reverse Proxy is the cheaper self-hosted option with a lower
  // ceiling. Below 8,000 r/s the Reverse Proxy is strictly the smarter buy.
  cdn:             { type: "cdn",             kind: "network",   cap: 50000,    baseMs: 5,  cost: 1, hitRatio: 0.85 },
  "load-balancer": { type: "load-balancer",   kind: "network",   cap: 10000,    baseMs: 2,  cost: 2 },
  "reverse-proxy": { type: "reverse-proxy",   kind: "network",   cap: 8000,     baseMs: 3,  cost: 1 },
  queue:           { type: "queue",           kind: "messaging", cap: 8000,     baseMs: 8,  cost: 1 },
  // Security — pass legit traffic through; block a share of malicious traffic.
  // WAF inspects payloads (better filter, slower); Rate Limiter is volumetric
  // (cheaper on latency, leakier against distributed attacks).
  waf:             { type: "waf",             kind: "security",  cap: 20000,    baseMs: 3,  cost: 1, filterRatio: 0.95 },
  "rate-limiter":  { type: "rate-limiter",    kind: "security",  cap: 20000,    baseMs: 1,  cost: 1, filterRatio: 0.8 },
};

export const modelOf = (type: string): ComponentModel | undefined => COMPONENT_MODELS[type];
