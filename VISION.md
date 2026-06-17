# System Design Quest

## Learn System Design Through Interactive Simulation

---

# Vision

Build the world's first simulation-based system design learning platform.

Users don't just draw architectures.

They build real systems, run traffic through them, observe failures, optimize performance, and learn through experimentation.

Think:

LeetCode + Factorio + Cities Skylines + System Design Interviews

---

# Core Concept

Traditional Learning:

Read article → Memorize architecture → Forget

System Design Quest:

Build architecture → Simulate traffic → Observe bottlenecks → Improve design → Unlock next level

Learning happens through cause and effect.

---

# Game Loop

1. Receive challenge
2. Watch business scenario animation
3. Build architecture
4. Run simulation
5. Analyze metrics
6. Optimize design
7. Earn score
8. Unlock next level

---

# Example Level

## Level 1 - TinyURL

Story:

A startup founder needs a URL shortening service.

Users are submitting long URLs and expect short links instantly.

Traffic:

100 Requests/Minute

Goal:

Generate short URLs reliably.

Available Components:

* Client
* API Service
* Database

Player builds:

Client → API → Database

Simulation starts.

Traffic packets animate through architecture.

Results:

Latency: 120ms

Availability: 100%

Score: 100/100

Level Complete

---

# Simulation Engine

Every architecture becomes a live simulation.

The engine is a **deterministic discrete-event simulation**, not a hand-tuned rule engine.

Every component has explicit, visible math:

* Capacity (requests/second)
* Base latency (ms)
* Cost (per hour)
* Failure behavior under overload

Each node behaves like a queue. Traffic above capacity builds backlog. Backlog increases latency. Sustained backlog causes timeouts and failures. Standard queueing behavior, applied consistently across every level.

Design principle:

**The player must be able to roughly predict the outcome before pressing Run.**

If the simulation feels arbitrary, players blame the game instead of their design. Every number that drives the result is shown on the component itself.

Determinism:

* Seeded random number generation
* Same architecture + same scenario = same result, every time
* Required for fair leaderboards, shareable replays, and trust in the system

The engine calculates:

* Request latency
* Throughput
* Availability
* Cost
* Resource utilization

Traffic is animated visually.

Requests move through nodes.

Bottlenecks become visible.

---

# Visual Feedback

Requests appear as moving packets.

Examples:

Client
↓
API
↓
Database

Packets move across connections.

At low traffic, individual packets are animated.

At scale, packets are sampled: a representative subset is drawn, and connection thickness + flow speed represent total volume. 50,000 requests/second is not drawable packet-by-packet — aggregation is a core renderer decision, made early.

Node colors indicate health.

Green = Healthy

Yellow = Under Load

Red = Bottleneck

Black = Failure

---

# Failure Simulation

The platform intentionally creates failures.

Examples:

Database Overload

API Timeout

Cache Miss Storm

Queue Backlog

Rate Limit Reached

Server Crash

Regional Outage

Network Latency Spike

---

# Learning Through Failure

Example:

Player Architecture:

Client
↓
Database

Simulation Result:

Database Exposed To Internet

Security Score: 0

Level Failed

Feedback:

Applications should communicate through an API layer.

Try adding an API service.

---

# Pedagogy Principles

A simulation can teach wrong lessons as easily as right ones. These principles guard against that:

**No single correct answer.**

Every level accepts multiple valid gold architectures. If there is exactly one winning diagram, the game becomes memorization — the thing it exists to replace.

**Outcomes, not checkboxes.**

Scores come from what happens in the simulation, never from component presence. "Has a WAF = +10 points" teaches cargo-cult architecture. Instead: run a DDoS scenario, and an architecture without rate limiting visibly fails.

**Cost punishes over-provisioning.**

The naive lesson of any scaling game is "always add more boxes." The cost dimension makes the over-built architecture lose to the right-sized one.

**Components can hurt.**

Some levels are designed so the reflex answer backfires: caches in write-heavy workloads, load balancers in front of a single stateful node, queues that hide consistency bugs. Players learn when a pattern applies, not just that it exists.

---

# Progressive Complexity

## Stage 1 - Foundations

Single Server

Blog Website

URL Shortener

Todo App

Concepts:

* APIs
* Databases
* Client Server

---

## Stage 2 - Scaling

Chat Application

Food Delivery App

E-commerce Store

Concepts:

* Load Balancers
* Horizontal Scaling
* Caching

---

## Stage 3 - Distributed Systems

WhatsApp

Instagram

Netflix

Concepts:

* Queues
* Event Processing
* CDN
* Object Storage

---

## Stage 4 - Enterprise Scale

YouTube

Uber

Amazon

Concepts:

* Multi Region
* Failover
* Data Replication
* Microservices

---

# Components Library

Compute

* API Gateway
* Backend Service
* Worker Service
* Auth Service

Storage

* SQL Database
* NoSQL Database
* Redis Cache
* Object Storage

Networking

* CDN
* Load Balancer
* DNS

Messaging

* Queue
* Event Bus
* Pub/Sub

Infrastructure

* Kubernetes Cluster
* Auto Scaling Group

Security

* WAF
* Rate Limiter
* Authentication Service

---

# Levels As Data

Levels are not code. Each level is a declarative definition (JSON DSL):

```json
{
  "id": "tinyurl-1",
  "story": "A startup founder needs a URL shortening service...",
  "traffic": { "profile": "steady", "rate": "100/min", "readWriteRatio": 0.9 },
  "allowedComponents": ["client", "api", "sql-db"],
  "failureInjections": [],
  "winConditions": { "p99LatencyMs": 200, "availability": 0.99, "maxCostPerHour": 5 }
}
```

Why this matters from day one:

* Level authoring becomes fast — content volume is the long-term bottleneck, not engine features
* Community-created levels (V3) require no new infrastructure
* The AI mentor (V2) can reason over the level spec, not just the player's diagram

---

# Architecture Scoring

Final Score =

Performance + Reliability + Scalability + Cost + Security

Example:

Performance: 92

Reliability: 80

Scalability: 95

Cost: 70

Security: 100

Final Score: 87

Every dimension is derived from observed simulation outcomes under the level's scenarios — never from which components are present. The per-dimension breakdown explains *why*, with links to the sim events that caused each deduction. The breakdown is the lesson.

---

# Dynamic Traffic Scenarios

The same architecture faces different situations.

Examples:

Normal Day

Black Friday

Marketing Campaign

Celebrity Mention

DDoS Attempt

Regional Failure

Database Crash

Users learn resilience.

---

# Replayability

Every level can be replayed.

Bronze

Silver

Gold

Platinum

Leaderboard ranks players by:

* Highest score
* Lowest latency
* Cheapest architecture
* Most reliable architecture

Deterministic simulation makes leaderboards fair and replays exact.

---

# AI Mentor

Integrated LLM-powered architecture coach.

The mentor consumes the **simulation event trace**, not just the diagram. Explanations are grounded in what actually happened in the player's run, not generic advice.

Features:

Explain failures (citing specific sim events)

Recommend improvements

Compare architecture patterns

Answer questions

Generate architecture reviews

Example:

"At t=42s your primary database hit 100% utilization because all read traffic targets it. Your p99 latency spiked to 2.1s at that moment. Consider adding a cache or read replica."

---

# Multiplayer Mode (Future)

Architecture Battles

Two players solve the same challenge.

Traffic simulation runs.

Winner determined by:

Performance

Cost

Reliability

---

# Technical Architecture

Frontend

* React
* TypeScript
* React Flow
* Framer Motion
* Zustand

Simulation Engine

* TypeScript, runs entirely client-side in a Web Worker
* Deterministic discrete-event simulation with seeded RNG
* Per-component performance model (capacity, latency, cost)

Why client-side:

* Instant feedback — no network round trip per run
* Zero server cost for the core loop
* Works offline
* Replays are free (re-run the seed)

Backend (V2, when leaderboards and accounts arrive)

* nestjs + fastify adapters
* supabase auth + supabase db

AI Layer (V2)

* TBD

Hosting

* TBD

---

# MVP Scope (First 8 Weeks)

Version 1

* Drag and Drop Canvas
* Client-side Simulation Engine
* Traffic Animation
* Scoring System
* 5 Polished Levels
* Progress in localStorage

Explicitly cut from V1:

* No authentication — localStorage until accounts matter
* No backend — the sim runs in the browser
* No AI

5 polished levels beat 10 rough ones. The first session decides retention.

Focus entirely on gameplay.

---

# V2

* Accounts + Backend (NestJS, Supabase Auth + Postgres)
* AI Mentor (grounded in sim traces)
* Interview Mode — timed challenges modeled on real system design interviews
* Daily Challenges
* Leaderboards
* Badges
* Replay Analysis

Interview Mode moves up from a Pro-tier afterthought: career-motivated engineers prepping for interviews are the most likely paying users. It is the buying trigger.

---

# V3

* Multiplayer
* Community Levels (built on the level DSL)
* Architecture Marketplace
* Enterprise Training

---

# Monetization

Free

* First 20 Levels

Pro ($10/month)

* Advanced Levels
* AI Mentor
* Interview Mode
* Architecture Reviews

Enterprise

* Internal Developer Training
* Team Competitions
* Skill Assessments

---

# Open Questions

* **Competitive validation** — interview-prep incumbents (ByteByteGo, Exponent, etc.) are content businesses, not simulations. Confirm via fresh search that no dominant sim-based player exists before committing.
* **Pricing validation** — is $10/month right, or is Interview Mode worth a higher tier on its own?
* **Level authoring tooling** — at what point does hand-writing JSON stop scaling, and does the level editor become an internal tool or a community-facing product?
* **Simulation fidelity ceiling** — how deep does the queueing model need to go (connection pools? replication lag?) before added realism stops improving learning?

---

# North Star

Become the Duolingo of System Design.

Users learn by building, breaking, and scaling systems rather than memorizing diagrams.
