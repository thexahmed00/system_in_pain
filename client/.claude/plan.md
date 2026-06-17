# Client Folder Structure — System Design Quest

## Context

`client/` is a fresh Next.js 16 (App Router) + React 19 + Tailwind 4 scaffold. Per
`VISION.md`, V1 is an entirely **client-side** interactive learning game: a drag-and-drop
React Flow canvas where players build architectures, a **deterministic discrete-event
simulation engine** that runs in a **Web Worker** (seeded RNG, per-component queueing
math), traffic animation, a multi-dimension scoring system, 5 levels authored as a **JSON
DSL**, and progress in `localStorage`. No backend/auth/AI in V1.

The single most important structural constraint: the **simulation engine must be pure,
framework-free TypeScript**, fully decoupled from React. It runs in a worker, must be
deterministic (same input → same output for fair leaderboards/replays), and is the part
most worth unit-testing. Everything else (canvas UI, animation, stores) depends on the
engine; the engine depends on nothing in the app. The folder layout enforces that boundary.

Chosen approach: **layered-by-concern** structure under a **`src/`** directory.

## Target Structure

```
client/
  src/
    app/                      # Next.js App Router (moved from root app/)
      layout.tsx
      page.tsx                # landing / level select
      play/[levelId]/page.tsx # game screen (thin — mounts features)
      globals.css

    engine/                   # PURE deterministic sim — NO React, NO DOM, NO Next imports
      rng/                    # seeded RNG (e.g. mulberry32 / xorshift)
      components/             # per-component performance models (capacity, latency, cost, failure)
      simulation/            # discrete-event loop, event queue, scheduler
      scoring/               # derive Performance/Reliability/Scalability/Cost/Security from sim trace
      types.ts                # engine domain types (SimEvent, SimResult, NodeModel...)
      index.ts                # public engine API surface

    worker/                   # Web Worker boundary
      simulation.worker.ts    # imports engine/, runs sim off main thread
      client.ts               # typed postMessage wrapper used by React side

    levels/                   # level DSL as DATA
      schema.ts               # Level type + zod (or similar) validator for the JSON DSL
      loader.ts               # load + validate level definitions
      definitions/            # one JSON file per level (tinyurl-1.json, ...)

    features/                 # React feature modules (UI + feature logic, co-located)
      canvas/                 # React Flow editor: nodes, edges, palette, drag-drop
        components/
        hooks/
      simulation/             # run controls, traffic animation, engine-bridge to worker
        components/
        hooks/
      scoring/                # score breakdown panel, per-dimension explanations
        components/

    components/ui/            # shared, dumb, reusable UI (buttons, panels, modal)

    stores/                   # Zustand stores (architecture graph, sim run state, progress)
      architecture.store.ts
      simulation.store.ts
      progress.store.ts       # localStorage-backed

    lib/                      # framework-agnostic helpers (localStorage wrapper, format, ids)
    hooks/                    # cross-feature React hooks
    types/                    # shared app-level types (not engine-internal)
```

## Key Boundaries (the rules that make this worth it)

- **`engine/` imports nothing from `app/`, `features/`, `stores/`, `worker/`, or React.**
  It is a standalone TS library. Verify with an ESLint `no-restricted-imports` / boundary
  rule so the purity can't rot.
- **`worker/` is the only bridge** between engine and UI. React never imports `engine/`
  directly for running a sim — it talks to `worker/client.ts`. (Reading engine *types* is
  fine.)
- **`levels/definitions/*.json` are data, not code.** The engine + a level loader consume
  them. This keeps level authoring cheap (the long-term content bottleneck per VISION) and
  sets up community levels in V3 with zero new infra.
- **`features/` own their UI**; `components/ui/` is only truly shared dumb primitives.
- **Stores hold app state; the engine holds no app state.** Determinism lives in the engine.

## Implementation Steps

1. **Add deps**: `react-flow` (`@xyflow/react`), `zustand`, `framer-motion`, and a schema
   validator (`zod`). Dev: `vitest` + `@testing-library/react` for engine + component tests.
   (Use `npm install --cache "$HOME/.npm-cache"` — the default `/tmp` cache is permission-broken.)
2. **Introduce `src/`**: move `app/` → `src/app/`. Update `tsconfig.json` `paths` to
   `"@/*": ["./src/*"]`. Next 16 auto-detects `src/app`.
3. **Scaffold the folders** above with `index.ts` barrels for `engine/`, `worker/`, `levels/`.
4. **Add boundary lint rule** (ESLint `no-restricted-imports`) forbidding `engine/` from
   importing React/Next/feature code — lock the purity in before code grows.
5. **Seed one vertical slice** to prove the layout: `tinyurl-1.json` level →
   `levels/loader` → `engine` minimal sim → `worker` bridge → `features/canvas` renders
   client→api→db → `features/simulation` runs it → `features/scoring` shows result. Don't
   build all of it now; one thin slice validates the boundaries.

## Files To Create/Modify

- Move: `client/app/*` → `client/src/app/*`
- Modify: `client/tsconfig.json` (paths `@/* → ./src/*`), `client/eslint.config.mjs`
  (add engine boundary rule), `client/package.json` (deps + `vitest` script)
- Create: folder tree above, starting with `src/engine/index.ts`, `src/worker/client.ts`,
  `src/levels/schema.ts`, `src/levels/definitions/tinyurl-1.json`

## Verification

- `npm run dev` boots, `src/app` routes resolve, `@/` alias imports work.
- `npm run lint` passes AND the engine boundary rule actually fails when a React import is
  added to an `engine/` file (test it once to confirm the guard works).
- `vitest` runs an engine unit test: same level + same seed → identical `SimResult` twice
  (determinism check).
- Vertical slice: open `/play/tinyurl-1`, drag client→api→db, press Run, see a score.
- `engine/` has zero imports of `react`, `next`, or `@/features` (grep to confirm).
