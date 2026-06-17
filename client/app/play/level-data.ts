import {
  MonitorSmartphone, Server, Box, Database, Zap, HardDrive,
  Globe, Network, ListOrdered, ShieldCheck, Gauge, Boxes,
  type LucideIcon,
} from "lucide-react";

export type Kind = "source" | "compute" | "storage" | "network" | "messaging" | "security";
export type Group = "Client" | "Compute" | "Storage" | "Networking" | "Messaging" | "Security";

export interface ComponentSpec {
  type: string;
  label: string;
  group: Group;
  kind: Kind;
  icon: LucideIcon;
  /** physics — shown on the node so outcomes are predictable (VISION) */
  cap: number;     // req/s per instance (Infinity for source)
  baseMs: number;  // base latency
  cost: number;    // $/hr per instance
}

/** Component library (VISION §Components Library). Keyed by type. */
export const CATALOG: Record<string, ComponentSpec> = {
  client:        { type: "client",        label: "Client",        group: "Client",     kind: "source",  icon: MonitorSmartphone, cap: Infinity, baseMs: 0,  cost: 0 },
  "api-gateway": { type: "api-gateway",   label: "API Gateway",   group: "Compute",    kind: "compute", icon: Server,            cap: 500,      baseMs: 20, cost: 2 },
  backend:       { type: "backend",       label: "Backend",       group: "Compute",    kind: "compute", icon: Box,               cap: 350,      baseMs: 25, cost: 2 },
  "sql-db":      { type: "sql-db",        label: "SQL Database",  group: "Storage",    kind: "storage", icon: Database,          cap: 200,      baseMs: 50, cost: 3 },
  "nosql-db":    { type: "nosql-db",      label: "NoSQL DB",      group: "Storage",    kind: "storage", icon: Boxes,             cap: 600,      baseMs: 30, cost: 3 },
  cache:         { type: "cache",         label: "Redis Cache",   group: "Storage",    kind: "storage", icon: Zap,               cap: 5000,     baseMs: 3,  cost: 2 },
  "object-store":{ type: "object-store",  label: "Object Store",  group: "Storage",    kind: "storage", icon: HardDrive,         cap: 1000,     baseMs: 40, cost: 1 },
  cdn:           { type: "cdn",           label: "CDN",           group: "Networking", kind: "network", icon: Globe,             cap: 50000,    baseMs: 5,  cost: 1 },
  "load-balancer":{ type: "load-balancer",label: "Load Balancer", group: "Networking", kind: "network", icon: Network,           cap: 10000,    baseMs: 2,  cost: 1 },
  queue:         { type: "queue",         label: "Queue",         group: "Messaging",  kind: "messaging", icon: ListOrdered,     cap: 8000,     baseMs: 8,  cost: 1 },
  waf:           { type: "waf",           label: "WAF",           group: "Security",   kind: "security", icon: ShieldCheck,      cap: 20000,    baseMs: 3,  cost: 1 },
  "rate-limiter":{ type: "rate-limiter",  label: "Rate Limiter",  group: "Security",   kind: "security", icon: Gauge,            cap: 20000,    baseMs: 1,  cost: 1 },
};

export const GROUP_ORDER: Group[] = ["Client", "Compute", "Storage", "Networking", "Messaging", "Security"];

export interface Level {
  id: string;
  stage: number;
  title: string;
  story: string;
  traffic: { profile: string; ratePerMin: number; readWriteRatio: number };
  allowedComponents: string[];
  winConditions: { p99LatencyMs: number; availability: number; maxCostPerHour: number };
  concepts: string[];
}

/** Level 1 — matches PRD/VISION DSL shape (the real engine will load these from JSON). */
export const TINYURL: Level = {
  id: "tinyurl-1",
  stage: 1,
  title: "TinyURL",
  story:
    "A startup founder needs a URL shortening service. Users submit long URLs and expect short links instantly. Generate short URLs reliably without breaking the bank.",
  traffic: { profile: "steady", ratePerMin: 100, readWriteRatio: 0.9 },
  allowedComponents: ["client", "api-gateway", "sql-db", "cache"],
  winConditions: { p99LatencyMs: 200, availability: 0.99, maxCostPerHour: 5 },
  concepts: ["APIs", "Databases", "Client–Server"],
};
