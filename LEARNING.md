# Learning Plan — System Design Quest

A path to understand everything behind the simulation engine **before** implementing
it. Each module: the concept, why it matters *here*, the key ideas, a small exercise
tied to a real file you'll build, and a checkpoint to know you've got it.

Best way to learn this project: build the engine one piece at a time, understanding
each before moving on. The modules below follow the actual build order in
`packages/sim-engine/`.

Read first (orientation, ~30 min): `VISION.md`, `sysdesign/docs/PRD.md` §5–7, and
`packages/sim-engine/README.md` (the coffee-shop model). Everything below makes more
sense after those.

---

## Module 1 — Determinism & seeded randomness
**Why here:** fair leaderboards + exact replays need the same input to always give
the same result. The backend re-runs the engine to verify scores — it must match
the client bit-for-bit.

**Key ideas**
- Pseudo-random vs true random; what a *seed* is.
- A PRNG is a function: state → next number + next state.
- Why `Math.random()` / `Date.now()` are banned in the engine.
- Integer/bit operations: XOR, bit shifts, `Math.imul`, `>>> 0` (unsigned).

**Exercise** → `src/rng/mulberry32.ts`
Implement `createRng(seed)`. Print 5 numbers for seed 42, run twice, confirm identical.
Change the seed, confirm the stream changes.

**Checkpoint:** explain in one sentence why two players with the same architecture get
the same score.

---

## Module 2 — Probability for simulation
**Why here:** real traffic isn't evenly spaced. We need realistic, repeatable gaps
between requests.

**Key ideas**
- Uniform distribution (what a PRNG gives) vs other shapes.
- **Exponential distribution** — models "time until next event."
- **Inverse-transform sampling**: turn a uniform `U` into another distribution.
  Formula used: `gap = −mean · ln(1 − U)`.
- **Poisson process** — events whose gaps are exponential; the standard model for
  arrivals.

**Exercise** → the `exp()` helper + arrival generation in `src/simulation/simulate.ts`
Generate 1 minute of arrivals at 1.7/sec. Count them (~100?). Look at the gaps — mostly
small, occasionally large (bursty). That's Poisson.

**Checkpoint:** why do we sample gaps instead of placing a request every 0.6s exactly?

---

## Module 3 — Queueing theory (the core)
**Why here:** this *is* the lesson the game teaches. Bottlenecks, backlog, "add a
cache" — all queueing.

**Key ideas**
- A server handles one job at a time; others wait in line.
- **Arrival rate λ**, **service rate μ** (= 1/service-time), **utilization ρ = λ/μ**.
- ρ < 1 stable; as ρ → 1 the wait explodes; ρ ≥ 1 the line grows without bound.
- **Little's Law**: `L = λ · W` (avg in system = arrival rate × time in system).
- M/M/1 (one server) vs M/M/c (c servers) — adding servers = adding baristas.

**Exercise** (paper first, then code) → `src/simulation/simulate.ts`
Hand-trace 5 requests through a 50ms DB at various arrival times (use the table in the
engine README). Compute each one's wait. Then read how the `start = max(arrival,
server_free)` line reproduces exactly that.

**Checkpoint:** at 90% utilization vs 50%, which has dramatically worse p99, and why?

---

## Module 4 — Discrete-event simulation (DES)
**Why here:** it's how we turn "components + traffic" into "what happened over time."

**Key ideas**
- Simulating a system as a sequence of events on a timeline.
- Two styles: (a) **per-request pass** (what we do now — simple, linear paths only);
  (b) **event scheduler** — a priority queue (min-heap) of timestamped events, popped
  in time order (needed later for branching graphs).
- Server bookkeeping: track each server's "free at" time.
- Timeouts / dropped work.

**Exercise** → finish reading `src/simulation/simulate.ts`
Trace the loop: arrivals → per-node `start/service/finish` → drop if > 1000ms. Add a
`console.log` of each drop.

**Checkpoint:** what changes would the per-request model need to handle a graph that
*branches* (one API talking to both a cache and a DB)?

---

## Module 5 — Statistics of the results
**Why here:** raw timings must become the numbers players are graded on.

**Key ideas**
- **Percentiles / order statistics**: p50 (median), p99 (tail). Sort, index at `q·n`.
- Why tail latency (p99) matters more than the average for user experience.
- **Availability** as an empirical probability: served / total.
- **Utilization** as a fraction of busy time → the green/yellow/red health colors.

**Exercise** → the metrics section of `src/simulation/simulate.ts`
Given a list of latencies, compute p50 and p99 by hand for a 10-item list, then verify
against the code.

**Checkpoint:** a system with 120ms average but 2s p99 — is it healthy? Why does the
game punish it?

---

## Module 6 — Graphs
**Why here:** an architecture *is* a directed graph; routing and the security check are
graph operations.

**Key ideas**
- Directed graph: nodes + edges; adjacency representation.
- Path traversal; **cycle detection** (the `seen` set).
- Source/terminal nodes.
- (Later) topological sort for evaluating branching DAGs.

**Exercise** → `src/simulation/route.ts`
Build `routeOf`: start at the Client, follow edges to a terminal. Test it on
Client→API→DB and on a disconnected node (should return null).

**Checkpoint:** how does the engine detect a "Database exposed to the Client" with one
edge check?

---

## Module 7 — Scoring & normalization
**Why here:** turns measurements into the 5 dimensions, and encodes the pedagogy
("outcomes, not checkboxes").

**Key ideas**
- **Ratio scoring + clamping**: `min(1, target/actual) · 100`.
- Penalty curves (cost over budget scales the score down).
- Aggregation (mean of dimensions).
- Designing metrics that can't be gamed by adding components.

**Exercise** → `src/scoring/score.ts`
Implement Performance and Cost from a run's metrics. Then add the Security rule
(source→storage edge = 0). Confirm Client→DB scores 0 security.

**Checkpoint:** why is "has a WAF → +10 points" a bad design, and how does outcome
scoring avoid it?

---

## Module 8 — TypeScript patterns used here
**Why here:** the engine leans on a few TS features for safety.

**Key ideas**
- `interface` / `type`, union types (e.g. `Status`, `SimEventType`).
- Discriminated unions (the event trace).
- Schema validation with **zod** — parse untrusted level JSON into typed data.
- `Record<K, V>` maps (the component catalog).

**Exercise** → `src/types.ts`, `src/levels/schema.ts`, `src/levels/loader.ts`
Define the `Level` type, then write the zod schema that validates `tinyurl-1.json`.
Feed it a broken JSON (missing `winConditions`) and watch it throw.

**Checkpoint:** what's the benefit of validating level JSON at load time vs trusting it?

---

## Module 9 — Testing & the determinism gate
**Why here:** tasks.md gates all UI work behind a proven-deterministic engine.

**Key ideas**
- Unit tests with **vitest**.
- **Golden / snapshot tests** — pin an expected result for a fixed input.
- **Property tests** — "running twice gives identical output."
- Test-driven confidence before building UI on top.

**Exercise** → `test/` in the engine package
Write the determinism test: `simulate(graph, level, seed)` twice → deep-equal. Write
the scoring test: Client→DB → security 0. Run `npm test` in the package.

**Checkpoint:** which single test, if it fails, means leaderboards can't be trusted?

---

## Module 10 — The surrounding stack (lighter, as needed)
Concepts you'll touch when wiring the engine into the app — learn just-in-time:
- **npm workspaces / monorepo** — why `packages/sim-engine` is shared by client + backend.
- **React Flow (`@xyflow/react`)** — nodes, edges, custom node types, the canvas.
- **Redux Toolkit** — slices, actions, `useSelector`/`useDispatch` (already wired in `/play`).
- **Web Workers** (next phase) — running the engine off the main thread so the UI
  stays smooth; typed `postMessage`.

---

## Suggested pace
- Modules 1–2: foundations (probability + determinism).
- Modules 3–5: the heart (queues, DES, stats) — spend the most time here.
- Modules 6–7: graphs + scoring.
- Modules 8–9: TypeScript + tests — solidify by writing the gate.
- Module 10: pick up while integrating.

Each module's exercise *is* the corresponding engine file, so by the end of Module 9
the engine is built, understood, and tested. When you're ready, say the word and we
implement them in this order — explaining each step as we go.
