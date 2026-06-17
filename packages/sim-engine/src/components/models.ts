import type { ComponentModel } from "../types";

/* =========================================================================
   Component physics — the single source of truth for the numbers.
   The client's UI catalog (icons/labels/groups) references these models.
   ========================================================================= */
export const COMPONENT_MODELS: Record<string, ComponentModel> = {
  client:          { type: "client",          kind: "source",    cap: Infinity, baseMs: 0,  cost: 0 },
  "api-gateway":   { type: "api-gateway",     kind: "compute",   cap: 500,      baseMs: 20, cost: 2 },
  backend:         { type: "backend",         kind: "compute",   cap: 350,      baseMs: 25, cost: 2 },
  "sql-db":        { type: "sql-db",          kind: "storage",   cap: 200,      baseMs: 50, cost: 3 },
  "nosql-db":      { type: "nosql-db",        kind: "storage",   cap: 600,      baseMs: 30, cost: 3 },
  cache:           { type: "cache",           kind: "storage",   cap: 5000,     baseMs: 3,  cost: 2 },
  "object-store":  { type: "object-store",    kind: "storage",   cap: 1000,     baseMs: 40, cost: 1 },
  cdn:             { type: "cdn",             kind: "network",   cap: 50000,    baseMs: 5,  cost: 1 },
  "load-balancer": { type: "load-balancer",   kind: "network",   cap: 10000,    baseMs: 2,  cost: 1 },
  queue:           { type: "queue",           kind: "messaging", cap: 8000,     baseMs: 8,  cost: 1 },
  waf:             { type: "waf",             kind: "security",  cap: 20000,    baseMs: 3,  cost: 1 },
  "rate-limiter":  { type: "rate-limiter",    kind: "security",  cap: 20000,    baseMs: 1,  cost: 1 },
};

export const modelOf = (type: string): ComponentModel | undefined => COMPONENT_MODELS[type];
