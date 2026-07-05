# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo layout

npm workspaces (`packages/*`, `client`, `sysdesign`). Three deliverables that share one engine:

- **`packages/sim-engine`** (`@sdq/sim-engine`) — the deterministic simulation engine. Framework-free (no React/Next/Nest) so the client **and** the backend import the *exact same code*. This is the heart of the product; read `packages/sim-engine/README.md` before touching it.
- **`client`** — Next.js 16 + React 19 frontend (the actual game UI). Consumes the engine as TypeScript source.
- **`sysdesign`** — NestJS 11 + Supabase backend (accounts, persistence, leaderboards, score verification). Early scaffold. Has its own detailed `sysdesign/CLAUDE.md`.

There are no root-level scripts. Run everything per workspace (`-w <name>` or `cd` into it).

## Commands

```bash
# sim-engine (from packages/sim-engine, or add -w @sdq/sim-engine)
npm test -w @sdq/sim-engine                         # vitest run (the determinism gate)
npm run test:watch -w @sdq/sim-engine
npm test -w @sdq/sim-engine -- test/probe.test.ts   # a single test file

# client (from client, or add -w client)
npm run dev -w client        # next dev on :3000
npm run build -w client
npm run lint -w client

# sysdesign backend — see sysdesign/CLAUDE.md (nest + jest + supabase local stack)
```

## The one idea everything depends on: determinism

Same `graph + seed` → byte-identical `SimResult`, on both client and Node. No `Math.random`, no `Date.now`, no wall-clock anywhere under `packages/sim-engine/src/`. Randomness comes only from the seeded PRNG (`src/rng/mulberry32.ts`).

This is what makes leaderboards fair, replays exact, and — critically — lets the backend **re-run the engine to verify a submitted score instead of trusting the client** (PRD §5.4). Breaking determinism silently breaks score verification. It is guarded by `packages/sim-engine/test/determinism.test.ts`; keep that green.

## How the pieces connect

- The engine's single public entry point is `simulate(graph, level, seed)` in `packages/sim-engine/src/index.ts` → runs the sim once (`simulation/simulate.ts`), grades it (`scoring/score.ts`), returns one `SimResult`. The client and the verification route both call *only* this.
- **Client → engine** is source-level, not a built package: `client/next.config.ts` sets `transpilePackages: ["@sdq/sim-engine"]` and imports resolve to the TS in `packages/sim-engine/src`. Edits to the engine are picked up without a build step.
- **Score verification** lives (for now) at `client/app/api/simulate/route.ts` — a Next route handler that re-runs `simulate` over the client's `{ graph, levelId, seed }`. This moves to the Nest backend in V2. The client's own reported score is never trusted.
- **Levels are data, not code** — JSON DSL validated by a Zod schema (`packages/sim-engine/src/levels/schema.ts`, `loader.ts`; example `definitions/tinyurl-1.json`). A level that can't drive a sim is a content bug.
- **An architecture is a typed graph** `{ nodes, edges }` where each node has a `type` + optional `config` — not prose, not an image. Component *physics* (capacity, latency, cost) live in `packages/sim-engine/src/components/models.ts`; component *presentation* (icons, labels) lives in the client. Keep that separation.

## Scoring model (why a component alone scores nothing)

The score comes from *observed simulation outcomes*, never from component presence or keyword matching. The engine models each node as a queue (M/M/1 today), measures p99 latency / availability / cost / utilization under seeded Poisson traffic, then grades those against the level's win conditions across five dimensions (Performance, Reliability, Scalability, Cost, Security). "Having a cache" earns nothing; a cache that measurably lowered p99 does. The coffee-shop walkthrough in `packages/sim-engine/README.md` explains the whole pipeline.

Grading is layered (see `scoring/score.ts` and the level schema):

- **Tier-1 steady gates** — thresholds on the normal-traffic run (p99, availability, cost…). Absent threshold = not enforced.
- **Tier-2 scenario gates** (`winConditions.scenarios`) — the sim is *re-run* per scenario (e.g. a traffic-multiplier spike) with a seed derived per scenario; Scalability is driven only by these spike runs. Pass requires every steady gate **and** every scenario gate.
- **Stars/medals** (`winConditions.stars`: silver/gold/platinum thresholds) — post-pass polish, surfaced in the UI.
- **Level flags** like `requireAppTier` and `requireWriteSplit` encode structural lessons (no client→DB shortcuts, cache-aside correctness); failover (with a 2s detection window — redundancy isn't free), read/write request-class routing (cache/CDN/replica = read path, queue = write path), and attack traffic (`traffic.maliciousRatio` + WAF/rate-limiter `filterRatio`; bots never cache-hit, availability counts legit users only) are wired into the sim (see `test/failover.test.ts`, `test/routing.test.ts`, `test/security.test.ts`).

Parts of `packages/sim-engine/src/types.ts` are still forward-declared scaffolding marked `TODO` (instances/M·M·c, queue limits/backpressure, replication lag, per-edge latency) — the *shape* is stable but the math lands incrementally. Don't assume a typed field is wired into the sim; grep for its use first.

## Client specifics

- **This is not the Next.js in your training data.** Next 16 + React 19 have breaking changes. Per `client/.claude/AGENTS.md`: read the relevant guide under `client/node_modules/next/dist/docs/` before writing framework code, and heed deprecation notices.
- State is **Redux Toolkit** (`client/app/store/`: `architecture.slice` = the graph being built, `sim.slice` = last result). The store disables `serializableCheck` because React Flow nodes carry non-plain data.
- Canvas is **React Flow** (`@xyflow/react`). Styling is **Tailwind v4** (PostCSS, no config file). Target UX is a **soft light theme**, 3-pane level screen (Question | Canvas | Components) — see `sysdesign/CLAUDE.md` "Client UX" and the PRD.

## Product source of truth

`sysdesign/docs/PRD.md` is the spec; `VISION.md` is the product vision; `LEARNING.md` is a running dev log. When product behavior is ambiguous, the PRD wins over inference from code.
