# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start:dev      # dev server with watch (port 3000, override via PORT env)
npm run start:debug    # watch + Node inspector
npm run build          # nest build -> dist/ (deletes outDir first)
npm run start:prod     # node dist/main (run build first)
npm run lint           # eslint with --fix over {src,apps,libs,test}
npm run format         # prettier --write over src + test

npm test                       # jest unit tests (*.spec.ts under src/)
npm test -- app.controller     # single test file by path/name fragment
npm run test:watch
npm run test:cov               # coverage -> coverage/
npm run test:e2e               # jest with test/jest-e2e.json config
```

Supabase local stack (CLI required; project linked, ref in `supabase/.temp/`):

```bash
supabase start   # boot local Postgres+API (db :54322, api :54321)
supabase stop
```

## Product context

System Design Quest = a **simulation-based** system-design learning game ("Duolingo of System Design"). Users build an architecture graph, a **deterministic discrete-event simulator** runs traffic through it, and the score comes from observed outcomes (latency, availability, cost, resilience) — **never** from component presence / keyword matching.

This repo is the **V2 backend** (accounts, persistence, leaderboards, score verification). The game loop + sim engine run **client-side** (separate frontend deliverable). Full spec: `docs/PRD.md`. Product vision: `../VISION.md` (repo root is `sysdesign/`; VISION.md sits one level up in `system-design-quest/`).

Load-bearing design facts (read `docs/PRD.md` before building features):
- **Score verification is the backend's key job.** Client submits `{ architecture, levelId, seed }` — **never a trusted score**. Backend re-runs the *same* deterministic sim engine over `architecture + seed`, recomputes the score, stores its own result. Client score is ignored or used only as a tamper signal.
- **Shared sim engine.** The deterministic engine must be packaged so both the client and this Node backend import the *same* code (npm workspace / shared TS package) — does not exist yet. Engine is seeded (no wall-clock, no `Math.random`); test with golden-file fixtures (architecture + seed → exact trace).
- **Levels are data, not code** — stored as a JSON DSL in the `levels.spec` JSONB column (story, traffic profile, allowedComponents, failureInjections, winConditions). A level that can't drive a sim is a content bug. v1: seeded via migrations.
- **Architecture submission = typed graph** (`{ nodes, edges }` with `type` + `config`), JSONB — not prose, not an image.
- **Core tables:** `profiles`, `levels`, `level_tags`, `runs` (`architecture`+`seed`+server-computed `result`), `progress`. `architecture`+`seed` are the verifiable record + enable replay.

Client UX (PRD §10.5–10.6): **soft light theme** (not dark); flow = intro+auth → **Play** → terminology primer (teaches Traffic / p99 / availability / cost / win-conditions before level 1) → 3-pane level screen: **Question (left) | Canvas (center) | Components (right)**. Auth is on the intro page, optional in V1 (guest + localStorage), gates progress/leaderboards in V2.

The `client/index.html` prototype is a throwaway engine-verification harness — dark, palette-left/results-right. It validates the DES engine + scoring, **not** the target UX/theme above. Real client = React + React Flow + Zustand.

## Architecture

NestJS 11 starter, **early scaffold stage** — only the default `App*` module/controller/service exist in `src/`. Supabase is configured locally but **not yet wired into the Nest app**; expect to build the integration when touching auth or DB.

- **Entry**: `src/main.ts` bootstraps `AppModule`. `AppModule` (`src/app.module.ts`) is the single root module — register new feature modules in its `imports`.
- **Auth — Supabase Auth** (not Clerk): Supabase issues a JWT on client login. Backend verifies the Bearer token with `SUPABASE_JWT_SECRET` (HS256) in a Nest guard, attaching `userId` (JWT `sub` claim) to the request. No guard wired yet. Identity lives in Supabase `auth.users`; app-level user data belongs in a `public.profiles` table (FK → `auth.users(id)`).
- **Database — Supabase**: local stack configured under `supabase/` (Postgres 17, default ports). No client/migrations in `src/` yet. Schemas exposed to the API: `public`, `graphql_public`. Server-side access uses the service-role key; user-scoped access should rely on RLS via `auth.uid()`.
- **Config**: `@nestjs/config` + `dotenv` are installed; `.env` is the secret source (currently empty). No `ConfigModule.forRoot()` call exists yet — add it to `AppModule` before relying on injected config.

## Conventions

- TypeScript is **loose**: `noImplicitAny: false`, `strictBindCallApply: false`. Only `strictNullChecks` is on. Module resolution is `nodenext` — use explicit ESM-style import semantics.
- Tests live beside source as `*.spec.ts` (jest `rootDir` is `src/`); e2e tests live in `test/`.
- Lint and format both auto-fix (`--fix` / `--write`); prettier config in `.prettierrc`, eslint in `eslint.config.mjs`.
