# System Design Quest — Product Requirements Document

> **Status:** Draft v0.2 · **Owner:** TBD · **Last updated:** 2026-06-13
> **Stack:** NestJS 11 + Supabase (Postgres 17 + Auth). Client-side TypeScript simulation engine.
> **North star:** The Duolingo of System Design — learn by building, breaking, and scaling real systems.
> See `../../VISION.md` for product vision. This PRD is the engineering spec derived from it.

## 1. Summary

System Design Quest is a **simulation-based** learning platform. Users don't draw diagrams and get keyword-matched — they **build an architecture, run real traffic through it via a deterministic simulator, watch it succeed or fail, and optimize**. Score comes from observed simulation outcomes (latency, availability, cost, resilience under failure injection), never from component presence.

The core game loop runs **entirely client-side** — instant feedback, zero server cost, free replays. The backend (this repo) exists for accounts, persistence, leaderboards, and score verification.

## 2. Problem & Goals

**Problem:** System-design learning is passive — articles, videos, static diagrams. No cause-and-effect. You memorize "add a cache" without ever seeing a cache fail under a write-heavy load. There is no feedback loop that punishes cargo-cult architecture.

**Goals**
- G1 — Teach system design through a build → simulate → observe → optimize loop.
- G2 — Score architectures from **simulation outcomes**, not checklists. Multiple valid gold designs per level.
- G3 — Deterministic engine: same architecture + same seed = same result, every time. Enables fair leaderboards and exact replays.
- G4 — Track progress (completed levels, medals, score history) to drive retention.

**Non-goals (v1)**
- Backend scoring as source of truth — v1 sim runs client-side, progress in localStorage.
- AI mentor (V2).
- Multiplayer / community levels (V3).
- Real-time collaborative whiteboarding; mobile native apps.

## 3. Target Users

- **Interview prepper** — engineer prepping senior/staff system-design rounds. Most likely paying user (Interview Mode = buying trigger).
- **Skill-builder** — working engineer leveling up architecture intuition.
- **Level author/admin** — curates levels as JSON DSL, defines traffic profiles + win conditions. v1: levels seeded via migrations.

## 4. Product Phasing

| Phase | Scope | Backend role |
|-------|-------|-------------|
| **V1 (MVP)** | Canvas, client-side sim engine, packet animation, scoring, 5 polished levels, localStorage progress | **None** — no auth, no backend |
| **V2** | Accounts, leaderboards, score verification, AI mentor, Interview Mode, daily challenges | **This repo** (NestJS + Supabase) |
| **V3** | Multiplayer, community levels (built on level DSL), marketplace | Extends V2 |

**This PRD specs the V2 backend.** V1 is a separate frontend deliverable (no backend dependency). Backend requirements below assume the client-side sim engine already exists and emits a verifiable `{architecture, seed, result}`.

## 5. The Simulation Engine (product core)

Lives client-side (TypeScript, Web Worker). Backend does **not** run the game loop, but **re-runs the same engine to verify scores** (§5.4). Specced here because it defines every data contract.

### 5.1 Model
- **Deterministic discrete-event simulation** with seeded RNG.
- Each component has explicit math: capacity (req/s), base latency (ms), cost/hr, failure behavior under overload.
- Each node behaves like a queue: traffic above capacity → backlog → higher latency → timeouts → failure.
- Design principle: player must roughly predict the outcome before pressing Run. No arbitrary numbers; every driver shown on the component.

### 5.2 Architecture submission (structured graph — NOT freeform)
A submission is a typed graph, not prose or an image. The simulator cannot run a JPEG.
```jsonc
{
  "nodes": [
    { "id": "n1", "type": "client" },
    { "id": "n2", "type": "api-gateway", "config": { "instances": 2 } },
    { "id": "n3", "type": "sql-db", "config": { "replicas": 1 } }
  ],
  "edges": [
    { "from": "n1", "to": "n2" },
    { "from": "n2", "to": "n3" }
  ]
}
```

### 5.3 Output — event trace
Engine emits an ordered event trace (the lesson + the animation driver + the AI-mentor input in V2):
```jsonc
{
  "seed": 12345,
  "events": [ { "t": 42.0, "node": "n3", "type": "saturation", "utilization": 1.0 } ],
  "metrics": { "p95LatencyMs": 180, "p99LatencyMs": 2100, "offeredRps": 100, "throughputRps": 94, "availability": 0.94, "costPerHour": 4.20 },
  "score": { "performance": 92, "reliability": 80, "scalability": 95, "cost": 70, "security": 100, "final": 87 }
}
```

### 5.4 Score verification (anti-cheat) — backend's key job
- Client submits `{ architecture, levelId, seed }` — **not** a trusted `score` int.
- Backend re-runs the **same deterministic engine** (shared package) over `architecture + seed`, recomputes the score, and stores **its own** result.
- Client-reported score is ignored or used only as a tamper signal (mismatch → flag).
- Requires the sim engine packaged so both client and Node backend import it (shared TS package / npm workspace).

## 6. Scoring (outcomes, not checkboxes)

Final score = weighted blend of **Performance + Reliability + Scalability + Cost + Security**, each derived from observed sim events under the level's scenarios.

- **Never** scored by component presence. "Has a WAF = +10" is forbidden — it teaches cargo-cult design.
- Cost dimension punishes over-provisioning so the right-sized design beats the over-built one.
- Per-dimension breakdown links to the sim events that caused each deduction. **The breakdown is the lesson.**
- Multiple valid gold architectures per level (no single correct diagram).

## 7. Levels As Data (JSON DSL)

Levels are declarative data, not code — fast authoring, community levels (V3) need no new infra, AI mentor (V2) reasons over the spec.
```jsonc
{
  "id": "tinyurl-1",
  "story": "A startup founder needs a URL shortening service...",
  "stage": 1,
  "traffic": { "profile": "steady", "rate": "100/min", "readWriteRatio": 0.9 },
  "allowedComponents": ["client", "api-gateway", "sql-db"],
  "winConditions": {
    "steady": {
      "minThroughputRps": 95,
      "maxErrorRate": 0.01,
      "p95LatencyMs": 150,
      "p99LatencyMs": 200,
      "availability": 0.99,
      "maxCostPerHour": 5
    },
    "scenarios": [],
    "resilience": []
  },
  "medals": {
    "silver":   { "maxCostPerHour": 3 },
    "gold":     { "maxCostPerHour": 2, "p95LatencyMs": 100 },
    "platinum": { "maxCostPerHour": 1.5 }
  }
}
```
The `levels.spec` JSONB stores this DSL, **not** prose `brief`/`constraints` fields. A level that can't drive a sim is a content bug.

### 7.1 Win conditions — three gate types

A submission passes a level only if it clears **every** gate across all three tiers. Difficulty ramps by *adding gate types*, not just tightening numbers (§7.3). All fields optional — a level sets only what it tests.

**Tier 1 — `steady` (base-load gates).** One sim run at the level's nominal traffic.

| Field | Pass when | Teaches |
|-------|-----------|---------|
| `minThroughputRps` | `throughputRps` ≥ value | **Anti silent-drop** — design must actually serve the load, not shed it |
| `maxErrorRate` | observed 5xx rate ≤ value | Correctness under load |
| `p95LatencyMs` | observed p95 ≤ value | Typical-case tail (chat, checkout) |
| `p99LatencyMs` | observed p99 ≤ value | Worst-case stragglers |
| `availability` | observed ≥ value | Fraction of requests that succeeded |
| `maxCostPerHour` | observed ≤ value | Punishes over-provisioning |

**Tier 2 — `scenarios` (named traffic events).** Re-run the sim under a different traffic shape; each entry has its own `mustMeet` thresholds (same field vocabulary as `steady`). Tests **scalability**.

```jsonc
"scenarios": [
  { "name": "black-friday",   "trafficMultiplier": 10, "mustMeet": { "availability": 0.95, "maxErrorRate": 0.05 } },
  { "name": "celebrity-spike","profile": "burst",      "mustMeet": { "minThroughputRps": 80 } },
  { "name": "ddos",           "profile": "attack",     "mustMeet": { "availability": 0.90 } }
]
```

**Tier 3 — `resilience` (failure injection).** Re-run the sim with a fault injected; the design must still meet `mustMeet`. Tests **reliability** as an *outcome*, not a checkbox.

```jsonc
"resilience": [
  { "inject": "kill-node:any-single", "mustMeet": { "availability": 0.95, "maxRecoveryMs": 5000 } },
  { "inject": "latency-spike:sql-db", "mustMeet": { "p99LatencyMs": 800 } },
  { "inject": "region-outage:a",      "mustMeet": { "availability": 0.90 } }
]
```

`kill-node:any-single` re-runs the sim once per node, killing each in turn — an architecture with a single point of failure fails at least one run. This **outcome-tests "no SPOF"** instead of structurally counting boxes, staying true to §6's outcomes-not-checkboxes rule.

### 7.2 Throughput & security semantics

**Throughput (anti-cheat-adjacent):** `offeredRps` = traffic pushed; `throughputRps` = requests *successfully completed* per second. A saturated node drops/queues overflow → `throughputRps < offeredRps`. Latency alone is gameable (shed the slow requests, p99 looks great); pairing it with `minThroughputRps` + `maxErrorRate` closes the hole.

**Security is scored as outcome, never presence.** No `requireWAF: true` or `requireRateLimiter: true` — that teaches cargo-cult design. Instead, a `ddos`/`attack` scenario pushes hostile traffic; an architecture without rate limiting visibly **fails the run**. Same for data exposure: a level can model a `client → sql-db` direct path as failing a security scenario rather than as a forbidden edge.

### 7.3 Difficulty ramp by stage

Levels get harder by **adding gate tiers**, not only by tightening thresholds. Stage 1 = ~3 steady gates; Stage 4 = a dozen across all three tiers.

| Stage | `steady` | `scenarios` | `resilience` | Lesson |
|-------|----------|-------------|--------------|--------|
| **1 Foundations** | throughput, availability, cost | — | — | make it work, don't overspend |
| **2 Scaling** | + p95 latency | spike (3×) | — | handle growth — cache / LB |
| **3 Distributed** | + p99, errorRate | Black Friday (10×) | kill-any-single-node | survive failure, no SPOF |
| **4 Enterprise** | full | multi-event + DDoS | kill-node + region-outage + latency-spike | failover, multi-region, replication |

Keep Stage 1 generous — frustration in the first session kills retention. 3 gates, roomy numbers.

### 7.4 Medals — graded on *how well*, not just pass/fail

Passing every gate = **Bronze** (level complete). `medals.silver/gold/platinum` are tighter threshold sets (cheaper, faster, survives more) layered on top. Drives replay (§Replayability) and leaderboards.

### 7.5 Engine cost note (multi-run scoring)

Scenarios + resilience gates mean the engine runs **N sims per submission** (1 base + one per scenario + one per node for `kill-node:any-single`). Fine client-side (each run is fast), but backend verification (§5.4) re-runs all N to recompute the score. **Cap N per level** (e.g. ≤ 12 total runs) so verification stays within the §11 latency budget. Store per-gate results in the run `result` so the UI can show which gate failed.

## 8. Functional Requirements (V2 backend)

### 8.1 Auth (Supabase Auth)
- FR-A1 — Email/password + OAuth via Supabase Auth; JWT issued to client.
- FR-A2 — API verifies Bearer JWT (`SUPABASE_JWT_SECRET`, HS256) via Nest guard; `@Public()` opens select routes.
- FR-A3 — First authed request ensures a `profiles` row (FK → `auth.users`).

### 8.2 Levels (content)
- FR-L1 — List levels: filter by stage (1–4), tag, completion status.
- FR-L2 — Get one level: full JSON DSL (story, traffic, allowedComponents, failureInjections, winConditions).
- FR-L3 — Levels seeded via migrations in v1; admin CRUD deferred.

### 8.3 Runs (submissions)
- FR-R1 — Submit a run: `{ levelId, architecture (graph JSONB), seed }`. **No client score trusted.**
- FR-R2 — Backend re-runs shared sim engine → computes `result` (metrics + per-dimension score + event trace ref). Stores server-computed result.
- FR-R3 — Reject malformed graphs (unknown node types, components not in level's `allowedComponents`, cycles where illegal) via validation before sim.
- FR-R4 — List/get a user's runs per level (history + replay: re-run stored `{architecture, seed}`).

### 8.4 Progress & Leaderboards
- FR-P1 — Mark level complete when a run meets `winConditions`.
- FR-P2 — Track best score per level, medals (Bronze/Silver/Gold/Platinum thresholds), total completed, streak.
- FR-P3 — Progress summary endpoint.
- FR-P4 — Leaderboard per level, rankable by: highest score, lowest latency, cheapest, most reliable. Fair because scores are server-verified + deterministic.

### 8.5 Platform
- FR-X1 — `/health` (DB ping).
- FR-X2 — Global `ValidationPipe` (whitelist), consistent error shape (exception filter), request logging.

## 9. Data Model (Supabase / Postgres)

| Table | Key fields | Notes |
|-------|-----------|-------|
| `profiles` | `id` PK/FK→`auth.users(id)`, `username`, `created_at` | App-level user data |
| `levels` | `id`, `slug`, `stage` (1–4), `spec` JSONB (full DSL), `created_at` | `spec` = the level JSON DSL, not prose |
| `level_tags` | `level_id`, `tag` | Filtering |
| `runs` | `id`, `user_id`→profiles, `level_id`, `architecture` JSONB, `seed` int, `result` JSONB (server-computed), `final_score` int, `passed` bool, `created_at` | One row per attempt. `architecture`+`seed` enable replay; `result` is server truth |
| `progress` | `user_id`, `level_id`, `best_score`, `medal`, `completed_at` | Maintained per user-level |

- **`architecture` + `seed` are the verifiable record** — never store a client score as truth.
- **RLS:** anyone reads `levels`/`level_tags`; users read/write only their own `runs`/`progress`/`profiles` via `auth.uid()`. Leaderboard reads need a public projection of `runs` (score + username, not full architecture) — view or policy. Admin writes content via service role.

## 10. API Surface (REST, `/api` prefix)

```
GET  /api/health
GET  /api/levels?stage=&tag=&status=
GET  /api/levels/:id                       # full DSL
POST /api/levels                           (admin)
PATCH/DELETE /api/levels/:id               (admin)
POST /api/levels/:id/runs                  # { architecture, seed } -> server scores
GET  /api/levels/:id/runs                  # own history
GET  /api/levels/:id/leaderboard?sort=score|latency|cost|reliability
GET  /api/runs/:id/replay                  # re-run stored architecture+seed
GET  /api/me/progress
GET  /api/me/profile
```

## 10.5 UX, Screens & Onboarding (client)

Frontend flow (React + React Flow + Zustand; **soft light theme** — see §10.6):

1. **Intro / landing** — hero pitch ("Learn system design by building, breaking, scaling"), **auth** (Supabase Auth: email + OAuth), and a primary **Play** CTA. Guest/demo entry allowed so V1 needs no account; sign-in unlocks saved progress + leaderboards (V2).
2. **Play → Onboarding primer** (first-time, skippable, replayable) — teaches the vocabulary *before* the first level so metrics aren't opaque:
   - **Traffic** — requests over time (e.g. `100 req/min`), steady vs bursty.
   - **p99 latency** — 99th-percentile response time; the slow tail users feel.
   - **Availability** — % of requests that succeed (not dropped/timed out).
   - **Cost** — $/hr to run the architecture; over-provisioning is penalized.
   - **Win conditions** — the level's pass bar, e.g. `p99 ≤ 200ms · avail ≥ 99% · cost ≤ $5/hr`.
   - Each term shown live on a 1-node toy sim so the player *sees* it move.
3. **Level / game screen** — three-pane layout:
   - **Left — Question panel:** story/brief, traffic profile, win conditions, allowed components. Becomes the **score + per-dimension breakdown + lesson** after Run.
   - **Center — Canvas:** drag-drop architecture builder, packet animation, node health colors.
   - **Right — Components palette:** the level's `allowedComponents`, grouped (Compute / Storage / Networking / …).
   - Controls (Run, seed, traffic ×) on the canvas toolbar.
4. **Level complete** — medal (Bronze/Silver/Gold/Platinum), score, "next level" + replay.

> **Phasing note:** V1 ships intro + primer + game with **guest/localStorage** progress; the auth panel is present but optional. Account-gated features (cross-device progress, leaderboards) light up in V2 when this backend lands. The `client/index.html` prototype predates this — its layout is palette-left / results-right and dark; it will be re-laid-out to question|canvas|components and re-themed.

## 10.6 Visual Design

- **Soft light theme** — light, low-contrast surfaces; gentle shadows; rounded corners; calm palette. Not the dark developer-tool look of the prototype.
- Health/status colors stay semantically loud against the light bg (green healthy → yellow load → red bottleneck → black failure) so simulation feedback remains instantly readable.
- Motion (Framer Motion) is purposeful: packet flow, node state transitions, score count-up — never decorative noise that obscures the sim signal.

## 11. Non-Functional Requirements

- **Stack:** NestJS 11 (Node), Supabase (Postgres 17 + Auth). Service-role key server-side; RLS for user scoping.
- **Shared sim engine:** packaged so client and backend import the **same** deterministic code (npm workspace / shared package). Version pinned — a sim engine change can shift historical scores; version the engine and store engine version on each run.
- **Determinism:** seeded RNG, no wall-clock / `Math.random` in the engine. Same input = same output across client and Node.
- **Security:** JWT verification on protected routes; RLS defense-in-depth; validate every graph before simulating; never trust client score.
- **Performance:** level list p95 < 300ms; server sim re-run target < 500ms for v1 level sizes (cap nodes/edges per level).
- **Testability:** `*.spec.ts` per service; e2e for guarded routes; **golden-file tests** for the engine (fixed architecture + seed → exact expected trace).

## 12. Milestones

- **M1 — Foundation:** ConfigModule, SupabaseModule, global pipes, `/health`.
- **M2 — Auth:** JWT guard, `@Public()`, profile bootstrap.
- **M3 — Sim engine packaging:** extract client sim into shared workspace package importable by Nest; golden-file tests.
- **M4 — Content:** `levels` schema + migrations + RLS, Levels module, seed 5 levels as DSL.
- **M5 — Runs + verification:** Runs module — accept `{architecture, seed}`, validate graph, re-run engine, store server-computed result.
- **M6 — Engagement:** Progress (best score, medals, streak) + per-level leaderboards.
- **M7 — Hardening:** exception filter, logging, tests, admin CRUD, engine versioning on runs.

## 13. Decisions & Open Questions

**Decided**
- **Scoring model** — simulation outcomes, not rubric. Backend re-runs the deterministic engine to verify; client score is never trusted. (Reversed from draft v0.1's rubric model — that contradicted the product's core.)
- **Submission format** — structured component graph (nodes + edges + config), JSONB. Not freeform text, not image upload. The simulator requires a typed graph.
- **DB access** — Supabase JS client (`@supabase/supabase-js`), REST + RLS. No ORM. `SupabaseService` wraps the client; service-role for server ops.
- **Sim runs client-side in V1**; backend verification arrives in V2 (this repo).
- **Visual theme** — soft **light** UI (§10.6), not dark. Status colors stay loud for sim readability.
- **Player flow** — intro+auth → **Play** → terminology primer (first run, skippable) → 3-pane level screen: **Question (left) | Canvas (center) | Components (right)** (§10.5).
- **Onboarding** — teach Traffic / p99 / availability / cost / win-conditions *before* level 1, each on a live toy sim.
- **Auth placement** — on the intro page; **optional in V1** (guest + localStorage), gates progress/leaderboards in V2.

**Open**
1. **Engine sharing mechanics** — monorepo workspace vs published private package? Affects how backend imports the sim. (Leaning workspace.)
2. **Engine versioning & score drift** — when the engine changes, do historical leaderboard scores recompute, freeze, or partition by engine version?
3. **Leaderboard exposure** — how much of a run's architecture is public? (Reveals solutions vs. enables learning-from-top-designs.)
4. **Admin/authoring** — in-app admin role + level editor, or migration-seeded DSL only through V2?
5. **Interview Mode** (V2 buying trigger) — timed; does it reuse the same run/scoring path with a clock, or a separate flow?
