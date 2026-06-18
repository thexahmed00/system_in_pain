# @sdq/sim-engine

The deterministic simulation engine behind System Design Quest. Framework-free
(no React/Next) so the client **and** the backend can run the exact same code —
the backend re-runs it to verify scores (PRD §5.4).

This README explains the model in plain terms first, then maps each idea to the
code, then lists the formal names for anyone who wants them.

---

## The mental model: a coffee shop

The player's architecture is a **coffee shop**. Requests are **customers**.
Components (API, Database, Cache) are **baristas**. Every number the engine
produces is answering one question: *does the shop keep up, or does the line
explode?*

### 1. Customers arrive
Level 1 sends 100 requests/min ≈ **1.7 per second**. Real traffic is bursty, not
evenly spaced, so we roll dice to pick the gap between each customer.

### 2. The dice repeat (this is why it's "deterministic")
True randomness would make every Run score differently → unfair leaderboards and
no exact replays. Instead we use a **seed**: the same seed produces the same dice
rolls, so the same architecture always gets the same result.

### 3. Each barista takes time to serve
- API barista: ~20ms per request
- Database barista: ~50ms per request

A customer flows Client → API → DB, so ~70ms **if nobody is waiting**.

### 4. The line (the one idea that matters)
A barista serves one customer at a time.
- Barista free when you arrive → served immediately.
- Barista busy → **wait in line.**

```
arrive at  0ms ─► DB free,         served   0–50ms
arrive at 30ms ─► DB busy until 50, WAIT,    served  50–100ms   (waited 20ms)
arrive at 40ms ─► DB busy until 100, WAIT,   served 100–150ms   (waited 60ms)
```

If customers arrive faster than a barista can serve, the **line keeps growing and
waits keep growing** — that's the core system-design lesson. Fixes: add a second
barista (more instances) or a faster one (a cache). A customer who waits longer
than **1000ms gives up** = a dropped request.

### 5. What we measure after the rush
- **Latency** — how long customers waited. We report the **99th-slowest (p99)**,
  not the average, because the slow 1% is what users feel.
- **Availability** — share who got served (didn't give up). 99 of 100 = 99%.
- **Cost** — $/hr to staff those baristas.
- **Utilization** — how busy each barista was (the health color):
  `< 50%` relaxed (green) · `~90%` line forming (yellow) · `100%+` overwhelmed
  (red/black).

### 6. From measurements to a score
Compare the measurements to the level's goal (Level 1: p99 ≤ 200ms, availability
≥ 99%, cost ≤ $5/hr):
- Goal met → near 100.
- p99 was 400ms but the goal was 200 → 200/400 = 50.

Average the five dimensions (Performance, Reliability, Scalability, Cost,
Security) → the final score. **No points for merely having a component — only for
what actually happened in the simulation.**

> One-line summary: **rigged dice → customers arrive → wait in lines → measure the
> waits → grade against the level's goal.**

---

## Where each idea lives in the code

| Idea (coffee shop) | File | What it does |
|---|---|---|
| Rigged repeatable dice | `src/rng/mulberry32.ts` | `createRng(seed)` uniform stream; `exp()` for gaps/jitter |
| Customers arrive, wait in lines | `src/simulation/simulate.ts` | per-request pass; each node a single-server queue |
| Which baristas, in what order | `src/simulation/route.ts` | Client → … → terminal path from the graph |
| How fast each barista is | `src/components/models.ts` | per-component capacity, base latency, cost |
| 99th-slowest, availability, cost | `src/simulation/simulate.ts` | metrics from the run |
| Grade vs the goal | `src/scoring/score.ts` | 5 dimensions → final score, pass/fail, lesson |
| The level's goal + story | `src/levels/` | DSL schema, loader, `definitions/tinyurl-1.json` |
| Public entry point | `src/index.ts` | `simulate(graph, level, seed)` → result |

### A worked Level 1 result
Client → API → Database at 100 req/min lands around **p99 125ms, availability
100%, $5/hr → score 100, COMPLETE**. Wire Client → Database directly (skipping the
API) and Security drops to **0** with an "exposed database" lesson — the same
teaching moment from the product vision.

---

## The formal names (optional)

If you want the textbook terms for what the plain words above describe:

- **Seeded PRNG** — `mulberry32`, a fast bit-mixing generator.
- **Exponential distribution via inverse transform** — `−mean · ln(1 − U)`.
- **Poisson arrival process** — gaps between customers are exponential with rate λ.
- **Queueing theory (M/M/1)** — single-server queue; utilization ρ = λ/μ; waiting
  blows up as ρ → 1. (Multi-server M/M/c arrives when components gain `instances`.)
- **Discrete-event idea** — we approximate it with a per-request pass today; a true
  event scheduler (min-heap of timestamped events) comes later for branching graphs.
- **Percentiles / order statistics** — p50, p99 of the latency sample.
- **Ratio scoring + clamping** — `min(1, target/actual) · 100`, averaged across dims.

## Determinism contract

Same `graph + seed` → identical `SimResult`, on client and Node. No `Math.random`,
no `Date.now`, no wall-clock anywhere in `src/`. This is what makes leaderboards
fair, replays exact, and lets the backend trust a re-run. It is enforced by a
determinism test (the build gate) and an ESLint rule banning framework imports here.
