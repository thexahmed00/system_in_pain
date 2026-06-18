# Engine Flow — how the functions connect & trigger

Visual companion to the README. Diagrams are [Mermaid](https://mermaid.js.org/) —
they render on GitHub and in most markdown viewers (VS Code: "Markdown Preview
Mermaid Support").

---

## 1. Trigger path — from the Run button to a score

```mermaid
flowchart LR
  Sleep[Sleep] --> Wake{Awake?}
  Wake -->|No| Sleep
  Wake -->|Hungry| Snack[Get treat]
  Wake -->|Not in in Sun?| Move[Move to sun]
  Wake -->|Human is typing| Keyboard[Sleep on keyboard]
  Snack --> Sleep
  Move --> Sleep
  Keyboard --> Sleep
```

What happens when a player clicks **Run** on `/play`. 

```mermaid
sequenceDiagram
    actor User
    participant Page as play/page.tsx (run)
    participant Store as Redux (sim.slice)
    participant Engine as @sdq/sim-engine simulate()
    participant Nodes as architecture.slice

    User->>Page: click "Run simulation"
    Page->>Store: dispatch(runStarted)
    Page->>Page: build Graph {nodes:{id,type}, edges}
    Page->>Engine: simulate(graph, level, seed)
    Engine-->>Page: SimResult {metrics, nodes, events, dims, final, passed, lesson}
    Page->>Nodes: dispatch(healthPainted(result.nodes))
    Page->>Store: dispatch(runFinished(result))
    Store-->>User: score panel + node health colors render
```

> Today `simulate()` runs on the main thread (hence the `PREVIEW ENGINE` tag). The
> next phase moves it into a Web Worker — the trigger path stays identical, only the
> call becomes async `postMessage`.

---

## 2. `simulate()` — orchestration (the public entry point)

```mermaid
flowchart TD
    A["simulate(graph, level, seed=12345)"] --> B["runOnce(graph, level, seed, mult=1)"]
    B --> C{"route found?"}
    C -- no --> D["return empty SimResult<br/>error: connect a Client…"]
    C -- yes --> E["base = run data<br/>(metrics, nodes, events)"]
    E --> F["score(graph, base, level, seed)"]
    F --> G["assemble SimResult<br/>(metrics + nodes + events + dims + final + passed + lesson)"]
    G --> H["return SimResult"]
```

---

## 3. `runOnce()` — the simulation itself

This is the coffee-shop model. One deterministic run at a traffic multiplier.

```mermaid
flowchart TD
    A["runOnce(graph, level, seed, mult)"] --> B["routeOf(graph)"]
    B --> C{"path null?"}
    C -- yes --> Z["return null"]
    C -- no --> D["rng = createRng(seed)"]
    D --> E["rate = ratePerMin/60 × mult"]
    E --> F["generate arrivals<br/>loop: t += exp(rng, 1/rate) until t > 60s"]
    F --> G["init per-node queue state<br/>{ free, busy }"]

    G --> H{"for each arrival a"}
    H --> I{"for each node in path"}
    I -- source --> I
    I -- service node --> J["start = max(cur, node.free)"]
    J --> K["wait? record saturation onset"]
    K --> L["svc = base×0.8 + exp(rng, base×0.2)"]
    L --> M["node.free = start+svc<br/>node.busy += svc<br/>cur = start+svc"]
    M --> N{"cur−a > 1000ms?"}
    N -- yes --> O["drop → push timeout event"]
    O --> H
    N -- no --> I
    I -- path done --> P["success++, record latency"]
    P --> H

    H -- all arrivals done --> Q["sort latencies → p50, p99"]
    Q --> R["availability = success/total<br/>cost = Σ component cost"]
    R --> S["per node: util = busy/60 → status<br/>(healthy/load/bottleneck/fail)"]
    S --> T["build event trace<br/>(saturation + timeout, sorted by t)"]
    T --> U["return { total, success, path, metrics, nodes, events }"]
```

---

## 4. `score()` — outcomes → five dimensions

```mermaid
flowchart TD
    A["score(graph, base, level, seed)"] --> P["Performance<br/>min(1, targetP99 / actualP99) ×100"]
    A --> R["Reliability<br/>min(1, availability / targetAvail) ×100"]
    A --> S["Scalability<br/>runOnce(seed ^ 0x5af3, mult=5)<br/>→ burst availability ×100"]
    A --> C["Cost<br/>over budget? cap/actual ×100 : 100"]
    A --> SE["Security<br/>source→storage edge? 0 : 100"]

    P --> F["final = mean(5 dims)"]
    R --> F
    S --> F
    C --> F
    SE --> F
    F --> G["passed = all win conditions met AND security=100"]
    G --> L["lesson = explain the weakest signal"]
    L --> O["return { dims, final, passed, lesson }"]
```

---

## 5. Function reference

| Function | File | Calls | Returns |
|---|---|---|---|
| `simulate` | `src/index.ts` | `runOnce`, `score` | `SimResult` |
| `runOnce` | `src/simulation/simulate.ts` | `routeOf`, `createRng`, `exp`, `modelOf` | `RunOnce \| null` |
| `routeOf` | `src/simulation/route.ts` | `modelOf` | `GraphNode[] \| null` |
| `score` | `src/scoring/score.ts` | `runOnce` (burst), `modelOf` | `Score` |
| `createRng` / `exp` | `src/rng/mulberry32.ts` | — | `Rng` / `number` |
| `modelOf` | `src/components/models.ts` | — | `ComponentModel \| undefined` |
| `loadLevel` | `src/levels/loader.ts` | `levelSchema.parse` | `Level` |

### Key trigger relationships
- **The UI never calls `runOnce` or `score` directly** — only `simulate()`. That single
  entry point is also what the backend will call to verify scores (one code path).
- **`score()` calls `runOnce()` a second time** for the 5× burst (Scalability). So a
  single `simulate()` runs the engine **twice**: once at 1×, once at 5× — both seeded,
  both deterministic.
- **`routeOf` is the gatekeeper**: no Client or no path → `runOnce` returns null →
  `simulate` returns the empty/error result and nothing else runs.

---

## Where the skeleton (TODO) parts will hook in

```mermaid
flowchart LR
    subgraph now["v1 (working)"]
      RO["runOnce: single-server queue"]
    end
    subgraph todo["scaffolded (TODO)"]
      Q["queue.ts: M/M/c multi-server"]
      W["workload.ts: read/write + cache hit/miss"]
      DAG["route.ts: routeDag fan-out"]
      FI["failures/inject.ts: spike / node-down"]
    end
    RO -. replace single server .-> Q
    RO -. classify requests .-> W
    B2["routeOf (linear)"] -. branch support .-> DAG
    F2["arrivals"] -. scenario stressors .-> FI
```
