# Tasks — System Design Quest (Client)

Build order is top-down. Each phase unlocks the next. Do not start UI before the engine
is deterministic (gate at task 11).

## Phase 0 — Scaffold

- [ ] 1. Add deps: `@xyflow/react`, `redux`, `framer-motion`, `zod`; dev: `vitest`, `@testing-library/react`. Install with `npm install --cache "$HOME/.npm-cache"` (default `/tmp` cache is permission-broken).
- [ ] 2. Move `app/` → `src/app/`. Update `tsconfig.json` paths `@/* → ./src/*`.
- [ ] 3. Create folder tree: `engine/ worker/ levels/ features/ stores/ components/ui lib/ hooks/ types/` with barrel `index.ts` where useful.
- [ ] 4. Add engine boundary lint rule (ESLint `no-restricted-imports`) blocking React/Next imports inside `engine/`. Verify it fails on purpose once, then revert the test import.

## Phase 1 — Engine core (framework-free, unit-tested)

- [ ] 5. Seeded RNG in `engine/rng/` (mulberry32). Test: same seed → same sequence.
- [ ] 6. Level DSL schema `levels/schema.ts` (zod) matching VISION JSON: id, story, traffic, allowedComponents, failureInjections, winConditions. `levels/loader.ts` validates.
- [ ] 7. First level data `levels/definitions/tinyurl-1.json`.
- [ ] 8. Component performance models in `engine/components/`: capacity, base latency, cost, failure-under-overload for `client`, `api`, `sql-db`.
- [ ] 9. Discrete-event sim loop in `engine/simulation/`: event queue + scheduler. Input graph + level → output `SimResult` + event trace.
- [ ] 10. Scoring in `engine/scoring/`: derive Performance/Reliability/Scalability/Cost/Security from the event trace.
- [ ] 11. **GATE** — determinism test: same graph + same seed → identical `SimResult` twice. Must pass before any UI work.

## Phase 2 — Worker bridge

- [ ] 12. `worker/simulation.worker.ts` runs the engine off the main thread.
- [ ] 13. `worker/client.ts` typed postMessage wrapper used by the React side.

## Phase 3 — UI vertical slice

- [ ] 14. Zustand stores in `stores/`: architecture graph + sim run state.
- [ ] 15. `features/canvas/` — React Flow editor, component palette, drag-drop to build client→api→db.
- [ ] 16. `features/simulation/` — Run control → worker → result.
- [ ] 17. `features/scoring/` — score breakdown panel.
- [ ] 18. `src/app/play/[levelId]/page.tsx` — mounts canvas + sim + scoring. **First playable milestone.**

## Phase 4 — Polish

- [ ] 19. Traffic animation (framer-motion packets moving across edges).
- [ ] 20. `stores/progress.store.ts` backed by localStorage.
- [ ] 21. Remaining 4 levels as JSON in `levels/definitions/`.

## Milestones

- **M1** (task 11): deterministic engine, no UI.
- **M2** (task 13): engine runs in worker, callable from main thread.
- **M3** (task 18): first playable level end-to-end.
- **M4** (task 21): 5 polished levels = V1 MVP.
