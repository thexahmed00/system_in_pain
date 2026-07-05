import {
  MonitorSmartphone, Server, Box, Database, Zap,
  Globe, Network, ListOrdered, ShieldCheck, Gauge, Boxes, DatabaseBackup, Waypoints, Split,
  type LucideIcon,
} from "lucide-react";
import type { Level } from "@sdq/sim-engine";

export type { Level };

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
  /** vertical scale ceiling — beyond this, scale horizontally (Load Balancer + replicas) */
  maxInstances?: number;
  /** Curriculum gate FALLBACK: a tool normally unlocks at the first level whose lesson
      includes it (see UNLOCK_LEVEL — keyed off allowedComponents, so nothing appears
      before it's taught). unlockStage only gates tools no level ever teaches. Once
      unlocked, a tool stays available in every later level, so the late game offers
      many tools — including ones that won't help — instead of handing the player
      exactly the answer. */
  unlockStage: number;
  /** One-line tooltip shown on the palette (and on the lock when still gated). */
  blurb: string;
}

/** Component library (VISION §Components Library). Keyed by type.
    `unlockStage` drives the progressive palette: a tool is draggable once the level's
    stage reaches it, then stays available (with distractors) in every later level. */
export const CATALOG: Record<string, ComponentSpec> = {
  client:        { type: "client",        label: "Client",        group: "Client",     kind: "source",  icon: MonitorSmartphone, cap: Infinity, baseMs: 0,  cost: 0, unlockStage: 1, blurb: "Where traffic originates." },
  // Compute — stateless; replicas scale horizontally via a Load Balancer once maxInstances is reached
  "api-gateway": { type: "api-gateway",   label: "API Gateway",   group: "Compute",    kind: "compute", icon: Server,            cap: 500,      baseMs: 20, cost: 2, maxInstances: 4, unlockStage: 1, blurb: "Front door — the app tier requests pass through." },
  backend:       { type: "backend",       label: "Backend",       group: "Compute",    kind: "compute", icon: Box,               cap: 350,      baseMs: 25, cost: 2, maxInstances: 4, unlockStage: 3, blurb: "A second compute tier for heavier processing." },
  // Storage — vertical ceiling; beyond it, add read-replicas or shard across nodes
  "sql-db":      { type: "sql-db",        label: "SQL Database",  group: "Storage",    kind: "storage", icon: Database,          cap: 200,      baseMs: 50, cost: 3, maxInstances: 3, unlockStage: 1, blurb: "Relational store. Durable, but the lowest throughput." },
  "nosql-db":    { type: "nosql-db",      label: "NoSQL DB",      group: "Storage",    kind: "storage", icon: Boxes,             cap: 600,      baseMs: 30, cost: 4, maxInstances: 3, unlockStage: 3, blurb: "3× the throughput of SQL — at a premium. Pay for it only when the load demands it." },
  cache:         { type: "cache",         label: "Redis Cache",   group: "Storage",    kind: "storage", icon: Zap,               cap: 5000,     baseMs: 3,  cost: 2, maxInstances: 3, unlockStage: 2, blurb: "In-memory read-cache — absorbs repeated reads. Useless for writes." },
  // Read replica — read-only copy of the primary; scales past the primary's own
  // replica ceiling. Writes still go to the primary only (readOnly routing).
  "read-replica":{ type: "read-replica",  label: "Read Replica",  group: "Storage",    kind: "storage", icon: Split,             cap: 200,      baseMs: 55, cost: 3, maxInstances: 4, unlockStage: 4, blurb: "Read-only copy of the primary — scales reads past the primary's own ceiling." },
  // Hot standby — idle copy of the primary that takes over only when the primary is
  // down. Costs continuously; its payoff is surviving a node-down outage.
  "db-standby":  { type: "db-standby",    label: "DB Standby",    group: "Storage",    kind: "storage", icon: DatabaseBackup,    cap: 200,      baseMs: 50, cost: 3, maxInstances: 1, unlockStage: 4, blurb: "Hot backup that takes over only when the primary fails." },
  // Networking — not replicated; a single LB / proxy / CDN handles the full ingress
  cdn:           { type: "cdn",           label: "CDN",           group: "Networking", kind: "network", icon: Globe,             cap: 50000,    baseMs: 5,  cost: 1, unlockStage: 4, blurb: "Edge read-cache — serves content near the user." },
  "load-balancer":{ type: "load-balancer",label: "Load Balancer", group: "Networking", kind: "network", icon: Network,           cap: 10000,    baseMs: 2,  cost: 2, unlockStage: 4, blurb: "Managed, premium front door — highest ceiling, lowest latency, costs more." },
  "reverse-proxy":{ type: "reverse-proxy",label: "Reverse Proxy", group: "Networking", kind: "network", icon: Waypoints,         cap: 8000,     baseMs: 3,  cost: 1, unlockStage: 4, blurb: "Cheaper self-hosted front door — lower ceiling, the smart buy under 8,000 r/s." },
  // Messaging — async write buffer; single node absorbs bursts, drains to storage
  queue:         { type: "queue",         label: "Queue",         group: "Messaging",  kind: "messaging", icon: ListOrdered,     cap: 8000,     baseMs: 8,  cost: 1, unlockStage: 3, blurb: "ACKs writes instantly, drains them to storage — absorbs bursts, not sustained overload." },
  // Security — pass legit traffic; block a share of attack traffic at the edge
  waf:           { type: "waf",           label: "WAF",           group: "Security",   kind: "security", icon: ShieldCheck,      cap: 20000,    baseMs: 3,  cost: 1, unlockStage: 4, blurb: "Inspects requests — blocks ~95% of attack traffic at the edge." },
  "rate-limiter":{ type: "rate-limiter",  label: "Rate Limiter",  group: "Security",   kind: "security", icon: Gauge,            cap: 20000,    baseMs: 1,  cost: 1, unlockStage: 4, blurb: "Volumetric shield — blocks ~80% of abusive traffic, barely any latency." },
};

export const GROUP_ORDER: Group[] = ["Client", "Compute", "Storage", "Networking", "Messaging", "Security"];

/* ── The curriculum ───────────────────────────────────────────────────────────
   One concept per level, traffic ramping as you progress. Every level is verified
   winnable with the intended lesson, and the naive build visibly fails. Difficulty
   comes from new gate types (a spike, a tighter budget), not just bigger numbers. */
export const LEVELS: Level[] = [
  // L1 — Foundations. The textbook answer (Client → API → DB) just works. A win.
  {
    id: "tinyurl-1",
    stage: 1,
    title: "TinyURL",
    story:
      "A founder needs a URL shortener. Light traffic, simple job: take a long URL, hand back a short one. Wire up the basics and make it work.",
    traffic: { profile: "steady", ratePerMin: 120, readWriteRatio: 0.9 },
    allowedComponents: ["client", "api-gateway", "sql-db"],
    winConditions: {
      steady: { minThroughputRps: 1.5, maxErrorRate: 0.05, p99LatencyMs: 300, availability: 0.99, maxCostPerHour: 6 },
      scenarios: [],
      resilience: [],
    },
    medals: { silver: { p99LatencyMs: 200 }, gold: { p99LatencyMs: 165 }, platinum: { p99LatencyMs: 150 } },
    challenges: [
      { id: "secure", label: "Secure", hint: "Keep the database behind an API — never exposed to the client", requireSecure: true },
      { id: "lean", label: "Lean", hint: "Solve it with 2 boxes (no extras)", maxComponents: 2 },
    ],
    concepts: ["Client–Server", "APIs", "Databases"],
  },

  // L2 — Caching. Read-heavy load drowns a lone DB; a cache absorbs the reads.
  //   Win:  Client → API → Cache → SQL  (cache soaks 80% of reads → DB stays under cap)
  //   Lose: Client → API → SQL          (300 r/s ≫ 200 cap → saturates)
  //         Client → API → SQL×2        (passes load but $8 > $7 budget — can't brute-force it)
  {
    id: "pastebin-2",
    stage: 2,
    title: "Pastebin",
    story:
      "Your paste-sharing site went viral on a forum. 90% of traffic is people reading the same popular pastes — and the database is buckling. The budget is too tight to just buy more database; make the reads cheaper instead.",
    traffic: { profile: "steady", ratePerMin: 18000, readWriteRatio: 0.9 },
    allowedComponents: ["client", "api-gateway", "sql-db", "cache"],
    winConditions: {
      steady: { minThroughputRps: 250, maxErrorRate: 0.02, p99LatencyMs: 200, availability: 0.99, maxCostPerHour: 7 },
      scenarios: [],
      resilience: [],
    },
    medals: { silver: { p99LatencyMs: 150 }, gold: { p99LatencyMs: 130 }, platinum: { p99LatencyMs: 115 } },
    challenges: [
      { id: "efficient", label: "Efficient", hint: "Serve it for $6/hr or less — one cache, one DB", maxCostPerHour: 6 },
      { id: "snappy", label: "Snappy", hint: "Keep p99 latency at or under 120ms", maxP99Ms: 120 },
    ],
    concepts: ["Caching", "Read-Heavy Workloads"],
  },

  // L3 — Datastore selection. A WRITE-heavy load: a cache is useless (you can't cache a
  // write) and the low-throughput SQL DB drowns. The decision is the right store, not more
  // boxes — so the L2 cache reflex actively fails here.
  //   Win:  Client → API → NoSQL DB   (600 r/s cap absorbs the writes)
  //   Lose: Client → API → SQL DB     (200 r/s cap ≪ load)
  //         Client → API → Cache → SQL (cache does nothing for writes → DB still saturates)
  {
    id: "write-firehose-3",
    stage: 3,
    title: "Write Firehose",
    story:
      "A telemetry service ingests a flood of events — 300 per second, and 80% of them are writes that must be stored. A read-cache can't help you here (there's nothing to cache), and your SQL database is drowning. Pick a datastore actually built for this write volume.",
    traffic: { profile: "steady", ratePerMin: 18000, readWriteRatio: 0.2 },
    allowedComponents: ["client", "api-gateway", "sql-db", "nosql-db", "cache"],
    winConditions: {
      steady: { minThroughputRps: 250, maxErrorRate: 0.02, p99LatencyMs: 200, availability: 0.99, maxCostPerHour: 7 },
      scenarios: [],
      resilience: [],
    },
    medals: { silver: { p99LatencyMs: 120 }, gold: { p99LatencyMs: 90 }, platinum: { maxCostPerHour: 6 } },
    challenges: [
      { id: "efficient", label: "Efficient", hint: "The right datastore needs no cache — solve it for $6/hr", maxCostPerHour: 6 },
      { id: "snappy", label: "Snappy", hint: "Keep p99 latency at or under 100ms", maxP99Ms: 100 },
    ],
    concepts: ["Datastore Selection", "Write-Heavy Workloads", "SQL vs NoSQL"],
  },

  // L4 — Elasticity. Survives normal load, but a 5× spike needs real headroom.
  {
    id: "flash-sale-4",
    stage: 3,
    title: "Flash Sale",
    story:
      "An e-commerce store is running a flash sale. Normal traffic is fine — but when the sale drops, demand spikes 5×. Build a system that doesn't fall over the moment everyone shows up at once.",
    traffic: { profile: "steady", ratePerMin: 12000, readWriteRatio: 0.9 },
    allowedComponents: ["client", "api-gateway", "sql-db", "cache"],
    winConditions: {
      steady: { minThroughputRps: 180, maxErrorRate: 0.02, p99LatencyMs: 250, availability: 0.99, maxCostPerHour: 16 },
      scenarios: [{ name: "traffic-spike", trafficMultiplier: 5, mustMeet: { availability: 0.95 } }],
      resilience: [],
    },
    medals: { silver: { maxCostPerHour: 14 }, gold: { maxCostPerHour: 13 }, platinum: { maxCostPerHour: 12 } },
    challenges: [
      { id: "unbreakable", label: "Unbreakable", hint: "Stay up even at a 7× surge", survivesMultiplier: 7 },
      { id: "efficient", label: "Efficient", hint: "Survive the surge for $14/hr or less", maxCostPerHour: 14 },
    ],
    concepts: ["Traffic Spikes", "Headroom", "Elasticity"],
  },

  // L5 — Cost discipline / right-sizing. The ONLY level that opens PRE-BUILT: the
  // canvas starts with the previous engineer's over-engineered stack (api×2 + cache +
  // db×2 = $12, double the budget). Winning means SUBTRACTING — delete the cache,
  // scale the replicas back down — until the smallest passing design remains.
  //   Win:  Client → API → SQL         ($5, 150 r/s < 200 cap → comfortably passes)
  //   Lose: the starter graph as-is    ($12 ≫ $6 budget — over-engineered)
  //         Client → API → Cache → SQL ($7 > $6 — still carrying the cache you don't need)
  {
    id: "lean-startup-5",
    stage: 3,
    title: "Lean Startup",
    story:
      "You inherited this system from an engineer who never met a component they didn't like. The load is modest and read-heavy — nowhere near what this stack was built for — and the burn rate is eating the runway. Nothing here is broken; there's just too much of it. Strip it back to the smallest design that still meets the bar.",
    traffic: { profile: "steady", ratePerMin: 9000, readWriteRatio: 0.95 },
    allowedComponents: ["client", "api-gateway", "sql-db", "cache"],
    starterGraph: {
      nodes: [
        { id: "client-1", type: "client", position: { x: 80, y: 200 } },
        { id: "api-1", type: "api-gateway", config: { instances: 2 }, position: { x: 340, y: 190 } },
        { id: "cache-1", type: "cache", position: { x: 600, y: 190 } },
        { id: "db-1", type: "sql-db", config: { instances: 2 }, position: { x: 860, y: 190 } },
      ],
      edges: [
        { source: "client-1", target: "api-1" },
        { source: "api-1", target: "cache-1" },
        { source: "cache-1", target: "db-1" },
      ],
    },
    winConditions: {
      steady: { minThroughputRps: 140, maxErrorRate: 0.02, p99LatencyMs: 150, availability: 0.99, maxCostPerHour: 6 },
      scenarios: [],
      resilience: [],
    },
    medals: { silver: { maxCostPerHour: 5 }, gold: { p99LatencyMs: 140 }, platinum: { maxCostPerHour: 5, p99LatencyMs: 140 } },
    challenges: [
      { id: "minimal", label: "Minimal", hint: "Two boxes behind the client — nothing more", maxComponents: 2 },
      { id: "efficient", label: "Efficient", hint: "Meet every bar for $5/hr", maxCostPerHour: 5 },
    ],
    concepts: ["Cost", "Right-Sizing", "Avoiding Over-Engineering"],
  },

  // L6 — Async Writes. Steady write load fits the DB — but a 3× ingest BURST mid-run
  // doesn't. A synchronous write path backs up during the burst and takes the rest of
  // the run to recover; a Queue ACKs the burst instantly and drains it with the DB's
  // spare capacity. The honest lesson: queues absorb SPIKES — they cannot create
  // capacity (sustained overload still fails via write-loss accounting).
  //   Win:  Client → API → Queue → DB       (avail ~0.97, p99 ~80ms — writes ACK at the queue)
  //         Client → API → {DB, Queue → DB} (reads direct, writes queued — same result)
  //   Lose: Client → API → DB       (burst backlog → avail ~0.34)
  //         Client → API → DB×2     (rides the burst but $8 > $7 — can't buy your way out)
  {
    id: "event-pipeline-6",
    stage: 3,
    title: "Event Pipeline",
    story:
      "Your telemetry service ingests 150 events per second, nearly all writes — and every night the batch upload window triples the firehose for ten straight seconds. The database keeps up on average but drowns in the burst, and the backlog wrecks the rest of the hour. Decouple the write path so a burst is absorbed, not fatal.",
    traffic: { profile: "bursty", ratePerMin: 9000, readWriteRatio: 0.05 },
    allowedComponents: ["client", "api-gateway", "queue", "sql-db"],
    failureInjections: [{ kind: "spike", atSecond: 25, durationSec: 10, multiplier: 3 }],
    winConditions: {
      steady: { minThroughputRps: 150, maxErrorRate: 0.05, p99LatencyMs: 300, availability: 0.96, maxCostPerHour: 7 },
      scenarios: [],
      resilience: [],
    },
    medals: { silver: { availability: 0.97 }, gold: { p99LatencyMs: 100 }, platinum: { maxCostPerHour: 6 } },
    challenges: [
      { id: "snappy", label: "Snappy", hint: "Keep p99 under 100ms — async writes ACK at the queue in ~30ms", maxP99Ms: 100 },
      { id: "efficient", label: "Efficient", hint: "Absorb the burst for $6/hr or less", maxCostPerHour: 6 },
    ],
    concepts: ["Async Writes", "Message Queues", "Burst Absorption"],
  },

  // L7 — Separation of concerns. The gateway is ingress; business logic + data access
  // belong in an app tier behind it. requireAppTier flags gateway→DB directly.
  //   Win:  Client → API Gateway → Backend → SQL DB   (gateway forwards, backend owns data)
  //   Lose: Client → API Gateway → SQL DB             (gateway wired straight to storage → security 0)
  // Traffic is light on purpose — the lesson is the layering, not capacity.
  {
    id: "service-tiers-7",
    stage: 3,
    title: "Service Tiers",
    story:
      "Your app grew from a script into a real service. Right now the gateway does everything — routing AND business logic AND database calls — and the team keeps stepping on each other. Split the concerns: let the gateway be the front door and move the application logic into its own tier behind it.",
    traffic: { profile: "steady", ratePerMin: 9000, readWriteRatio: 0.8 },
    allowedComponents: ["client", "api-gateway", "backend", "sql-db", "cache"],
    requireAppTier: true,
    winConditions: {
      steady: { minThroughputRps: 130, maxErrorRate: 0.02, p99LatencyMs: 250, availability: 0.99, maxCostPerHour: 12 },
      scenarios: [],
      resilience: [],
    },
    medals: { silver: { p99LatencyMs: 150 }, gold: { p99LatencyMs: 120 }, platinum: { maxCostPerHour: 8 } },
    challenges: [
      { id: "lean", label: "Lean", hint: "Split the tiers with 4 boxes — gateway, app tier, data, and the client", maxComponents: 3 },
      { id: "efficient", label: "Efficient", hint: "Keep the layered design at $8/hr or less", maxCostPerHour: 8 },
    ],
    concepts: ["Separation of Concerns", "App Tier", "Gateway vs Backend"],
  },

  // L7 — CDN. 95%-read global traffic crushes the origin; push content to the edge.
  //   Win:  Client → CDN → API → DB  (CDN absorbs 85% of reads → avail ~1.0)
  //   Lose: Client → API → DB        (DB at 500 r/s >> 200 r/s cap → avail ~0.01)
  {
    id: "global-reads-7",
    stage: 4,
    title: "Global Reads",
    story:
      "A breaking story goes viral — 30,000 requests per minute, 95% of them reading the same content. The origin server is on its knees. Serve the world at the edge before it ever reaches your data center.",
    traffic: { profile: "steady", ratePerMin: 30000, readWriteRatio: 0.95 },
    allowedComponents: ["client", "cdn", "api-gateway", "cache", "sql-db"],
    winConditions: {
      steady: { minThroughputRps: 400, maxErrorRate: 0.02, p99LatencyMs: 150, availability: 0.99, maxCostPerHour: 12 },
      scenarios: [],
      resilience: [],
    },
    medals: { silver: { p99LatencyMs: 100 }, gold: { p99LatencyMs: 80 }, platinum: { maxCostPerHour: 7 } },
    challenges: [
      { id: "snappy", label: "Snappy", hint: "Keep p99 under 100ms — the CDN edge hits in under 10ms", maxP99Ms: 100 },
      { id: "efficient", label: "Efficient", hint: "Serve the world for $8/hr or less", maxCostPerHour: 8 },
    ],
    concepts: ["CDN", "Edge Caching"],
  },

  // L8 — Viral Scale. Traffic exceeds what one node can ever handle; LB + multi-backend is the answer.
  //   maxInstances cap (4) means api×4 = 2000 r/s < 2100 r/s needed → fails (avail ~0.31)
  //   Win:  Client → LB → [api×3, api×3] → Cache → DB×3  (3000 r/s > 2100 → avail ~1.0)
  {
    id: "viral-scale-8",
    stage: 4,
    title: "Viral Scale",
    story:
      "A product launch drives 126,000 requests per minute. One API server handles 500 r/s; scaled to the maximum (×4) it reaches 2,000 r/s — still not enough. The only way forward is to break through the single-machine ceiling with a fleet behind a Load Balancer.",
    traffic: { profile: "steady", ratePerMin: 126000, readWriteRatio: 0.95 },
    allowedComponents: ["client", "load-balancer", "reverse-proxy", "api-gateway", "cache", "sql-db"],
    winConditions: {
      steady: { minThroughputRps: 1500, maxErrorRate: 0.02, p99LatencyMs: 200, availability: 0.99, maxCostPerHour: 35 },
      scenarios: [],
      resilience: [],
    },
    medals: { silver: { maxCostPerHour: 30 }, gold: { maxCostPerHour: 27 }, platinum: { maxCostPerHour: 24 } },
    challenges: [
      { id: "efficient", label: "Efficient", hint: "Right-size the fleet — serve it for $26/hr or less", maxCostPerHour: 26 },
      { id: "snappy", label: "Snappy", hint: "Keep p99 at or under 120ms — a well-distributed load is a fast load", maxP99Ms: 120 },
    ],
    concepts: ["Load Balancing", "Horizontal Scaling"],
  },

  // L9b — Reverse Proxy vs Load Balancer. Both clear this scale (front-door demand is
  // well under either's cap), but they're not free: Load Balancer is the pricier
  // managed tier, Reverse Proxy the cheaper self-hosted one. Below 8,000 r/s at the
  // front door, buying the premium option is exactly the Lean Startup mistake again —
  // just at the network layer instead of the database layer.
  //   Win:   Client → Reverse Proxy → [api×3, api×3] → Cache → NoSQL  ($19, the smart buy)
  //   Also passes: same shape with a Load Balancer instead ($20 — not wrong, just pricier)
  //   Lose:  a single overloaded API Gateway with no front door at all (no fan-out → saturates)
  {
    id: "rush-hour",
    stage: 4,
    title: "Rush Hour",
    story:
      "A regional delivery app is having its best week ever — real growth, not a viral spike, and it needs a front door to fan traffic across a small fleet. It's nowhere near the scale that justifies the premium managed load balancer your last job always reached for. Match the front door to the traffic you actually have.",
    traffic: { profile: "steady", ratePerMin: 144000, readWriteRatio: 0.95 },
    allowedComponents: ["client", "load-balancer", "reverse-proxy", "api-gateway", "cache", "nosql-db"],
    winConditions: {
      steady: { minThroughputRps: 2200, maxErrorRate: 0.02, p99LatencyMs: 200, availability: 0.99, maxCostPerHour: 22 },
      scenarios: [],
      resilience: [],
    },
    medals: { silver: { p99LatencyMs: 150 }, gold: { p99LatencyMs: 120 }, platinum: { maxCostPerHour: 19 } },
    challenges: [
      { id: "efficient", label: "Efficient", hint: "The cheaper front door is enough here — serve it for $19/hr", maxCostPerHour: 19 },
      { id: "snappy", label: "Snappy", hint: "Keep p99 at or under 120ms", maxP99Ms: 120 },
    ],
    concepts: ["Load Balancer vs Reverse Proxy", "Cost-Aware Networking"],
  },

  // L9 — Cache-aside / read-write split. Writes must NOT flow through the read cache.
  //   Win:  Client → API → Cache (reads) + API → DB (writes), Cache → DB (miss)
  //   Lose: Client → API → Cache → DB   (writes tunnel through the cache → requireWriteSplit)
  // The flow animation is the teacher here: build it right and reads glow blue to the
  // cache, writes glow amber straight to the datastore.
  {
    id: "cache-aside-9",
    stage: 4,
    title: "Split the Streams",
    story:
      "Your read cache is doing its job on the 90%-read load — but every write is being funneled through it too, and a cache is no place for a write. Wire it the real way: reads served from the cache, writes going straight to the datastore. Run it and watch the two streams separate.",
    traffic: { profile: "steady", ratePerMin: 18000, readWriteRatio: 0.9 },
    allowedComponents: ["client", "api-gateway", "cache", "sql-db", "nosql-db"],
    requireWriteSplit: true,
    winConditions: {
      steady: { minThroughputRps: 250, maxErrorRate: 0.02, p99LatencyMs: 250, availability: 0.99, maxCostPerHour: 10 },
      scenarios: [],
      resilience: [],
    },
    medals: { silver: { p99LatencyMs: 150 }, gold: { p99LatencyMs: 120 }, platinum: { maxCostPerHour: 7 } },
    challenges: [
      { id: "secure", label: "Secure", hint: "Keep every datastore behind the API", requireSecure: true },
      { id: "efficient", label: "Efficient", hint: "Serve the split for $7/hr or less", maxCostPerHour: 7 },
    ],
    concepts: ["Cache-Aside", "Read/Write Split"],
  },

  // L9c — Read Replica. A relational primary has a hard replica ceiling (maxInstances 3
  // → 600 r/s max, no matter the budget); a read-only replica scales past it (maxInstances
  // 4 → 800 r/s), and the engine automatically splits reads to the replica / writes to
  // the primary (the same readOnly routing rule read-replica has always had, just never
  // exposed to players until now).
  //   Win:  Client → API → {SQL primary (writes), Read Replica ×4 (reads)}  ($19, avail ~1.0)
  //   Lose: Client → API → SQL ×3            (600 r/s ceiling < 665 r/s of reads — capped, not broke)
  //         same shape with Read Replica ×3  (short by one instance — still saturates)
  {
    id: "read-replica",
    stage: 4,
    title: "Read Replica",
    story:
      "Your billing system is relational for a reason — the finance team will not sign off on a NoSQL migration. But read traffic has outgrown what the primary can vertically scale to, no matter how much you're willing to spend on it. Scale the reads without touching the write path.",
    traffic: { profile: "steady", ratePerMin: 42000, readWriteRatio: 0.95 },
    allowedComponents: ["client", "api-gateway", "sql-db", "read-replica"],
    winConditions: {
      steady: { minThroughputRps: 650, maxErrorRate: 0.02, p99LatencyMs: 200, availability: 0.99, maxCostPerHour: 21 },
      scenarios: [],
      resilience: [],
    },
    medals: { silver: { p99LatencyMs: 180 }, gold: { p99LatencyMs: 150 }, platinum: { maxCostPerHour: 19 } },
    challenges: [
      { id: "efficient", label: "Efficient", hint: "Size the replica fleet exactly — solve it for $19/hr", maxCostPerHour: 19 },
      { id: "snappy", label: "Snappy", hint: "Keep p99 at or under 150ms", maxP99Ms: 150 },
    ],
    concepts: ["Read Replication", "Vertical Scaling Ceiling", "Read/Write Split"],
  },

  // L10 — Redundancy / Failover. The primary DB dies mid-run; only a hot standby survives it.
  //   Win:  Client → API → sql-db, API → db-standby  (standby takes over during the outage)
  //   Lose: Client → API → sql-db                     (every request dropped while the DB is down)
  // A capacity win here is impossible — the only answer is a redundant copy.
  {
    id: "always-on-9",
    stage: 4,
    title: "Always On",
    story:
      "Your payments service can't blink. At peak, a hardware fault takes the primary database offline for 20 seconds. Adding more capacity won't save you — a dead database at any size is still dead. Design so a single component failure never takes the whole system down.",
    traffic: { profile: "steady", ratePerMin: 6000, readWriteRatio: 0.5 },
    allowedComponents: ["client", "api-gateway", "sql-db", "db-standby"],
    failureInjections: [{ kind: "node-down", atSecond: 20, durationSec: 20, nodeType: "sql-db" }],
    winConditions: {
      steady: { minThroughputRps: 45, maxErrorRate: 0.05, p99LatencyMs: 400, availability: 0.95, maxCostPerHour: 12 },
      scenarios: [],
      resilience: [],
    },
    medals: { silver: { availability: 0.96 }, gold: { p99LatencyMs: 200 }, platinum: { maxCostPerHour: 8 } },
    challenges: [
      { id: "secure", label: "Secure", hint: "Keep every database behind the API — never exposed to the client", requireSecure: true },
      { id: "efficient", label: "Efficient", hint: "Buy resilience for $9/hr or less — one standby, not a fleet", maxCostPerHour: 9 },
    ],
    concepts: ["Redundancy", "Failover", "Single Point of Failure"],
  },

  // L11 — Edge security. Half the traffic is a bot flood. Bots never cache-hit (they
  // request uncacheable junk), so even a healthy cache lets them hammer the DB — real
  // users pay for the stolen capacity, and the Security dimension is zeroed for the
  // breach. The fix is filtering at the front door; BOTH security tools work, with
  // honest trade-offs (WAF filters more; Rate Limiter is leakier but lower-latency).
  //   Win:  Client → WAF → API → Cache → DB          (avail ~1.0, security 100)
  //         Client → Rate Limiter → API → Cache → DB (also passes — player's choice)
  //   Lose: Client → API → Cache → DB (bots pass the cache → DB saturates → avail ~0.75, security 0)
  {
    id: "bot-flood-11",
    stage: 4,
    title: "Bot Flood",
    story:
      "Your ticket-sales site is getting scraped to death: half of all traffic is bots hammering random pages. Your cache can't help — the junk requests never repeat, so every one of them punches through to the database while real customers watch spinners. Stop the flood at the front door, before it touches your origin.",
    traffic: { profile: "steady", ratePerMin: 21000, readWriteRatio: 0.9, maliciousRatio: 0.5 },
    allowedComponents: ["client", "waf", "rate-limiter", "api-gateway", "cache", "sql-db"],
    winConditions: {
      steady: { minThroughputRps: 150, maxErrorRate: 0.02, p99LatencyMs: 250, availability: 0.99, maxCostPerHour: 9 },
      scenarios: [],
      resilience: [],
    },
    medals: { silver: { p99LatencyMs: 200 }, gold: { p99LatencyMs: 130 }, platinum: { maxCostPerHour: 8 } },
    challenges: [
      { id: "snappy", label: "Snappy", hint: "Keep p99 at or under 120ms while under attack", maxP99Ms: 120 },
      { id: "efficient", label: "Efficient", hint: "Defend the origin for $8/hr or less", maxCostPerHour: 8 },
    ],
    concepts: ["Edge Security", "WAF", "Rate Limiting", "DDoS"],
  },

  // L12 — WAF vs Rate Limiter, for real this time. Bot Flood let either tool pass —
  // here the flood is heavy enough that the LEAK matters, not just the block rate. Both
  // filters clear the 70%-blocked security bar (WAF 95%, Rate Limiter 80%), so this
  // isn't a security-flag failure — it's capacity math: Rate Limiter's 20% leak, added
  // to legit traffic, is still more than the origin can absorb; WAF's 5% leak isn't.
  //   Win:  Client → WAF → API → NoSQL            (leak stays under capacity → avail ~1.0)
  //   Lose: Client → Rate Limiter → API → NoSQL   (leak alone saturates the gateway → avail ~0.10)
  //         Client → API → NoSQL (no filter)      (fails security AND capacity both)
  {
    id: "overwhelmed",
    stage: 4,
    title: "Overwhelmed",
    story:
      "Bot Flood's attacker is back with a botnet ten times the size. Whatever filtered through last time isn't cutting it — the leaked traffic alone is enough to bury your origin. A rough volumetric shield was fine before; this flood needs tighter inspection at the edge.",
    traffic: { profile: "steady", ratePerMin: 150000, readWriteRatio: 0.9, maliciousRatio: 0.96 },
    allowedComponents: ["client", "waf", "rate-limiter", "api-gateway", "nosql-db"],
    winConditions: {
      steady: { minThroughputRps: 90, maxErrorRate: 0.03, p99LatencyMs: 250, availability: 0.97, maxCostPerHour: 10 },
      scenarios: [],
      resilience: [],
    },
    medals: { silver: { availability: 0.995 }, gold: { p99LatencyMs: 100 }, platinum: { maxCostPerHour: 7 } },
    challenges: [
      { id: "efficient", label: "Efficient", hint: "Hold the line for $7/hr or less", maxCostPerHour: 7 },
      { id: "snappy", label: "Snappy", hint: "Keep p99 at or under 100ms under fire", maxP99Ms: 100 },
    ],
    concepts: ["WAF vs Rate Limiter", "DDoS Mitigation", "Filter Strength"],
  },
];

/** Levels keyed by id (server verification + level lookup). */
export const LEVELS_BY_ID: Record<string, Level> = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

/** Level index (0-based) at which each tool becomes draggable: the first level whose
    lesson includes it (allowedComponents) — so nothing appears before it's taught and
    the player is never left guessing between, say, Backend and API Gateway. A tool no
    level teaches yet (e.g. Object Store, waiting on its own level) stays locked past
    the end of the curriculum rather than sneaking in early via a stage number. Once
    unlocked, a tool stays available in every later level. */
export const UNLOCK_LEVEL: Record<string, number> = Object.fromEntries(
  Object.keys(CATALOG).map((type) => {
    const byLesson = LEVELS.findIndex((l) => l.allowedComponents.includes(type));
    return [type, byLesson !== -1 ? byLesson : LEVELS.length];
  }),
);

/** @deprecated First level kept as a named export for older imports — use LEVELS. */
export const TINYURL = LEVELS[0];
