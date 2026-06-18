/* Module 2 demo — exponential / Poisson arrivals.
   Throwaway learning script: reuses the engine's createRng + exp (no new math).
   Run:  node --experimental-strip-types scripts/arrivals-demo.ts
   Mirrors the arrival loop in src/simulation/simulate.ts:38-45. */

import { createRng, exp } from "../src/rng/mulberry32.ts";

const DURATION = 60; // seconds simulated (one minute)
const rate = 100 / 60; // req/s — the tinyurl-1 rate (≈1.667/s), i.e. ~1.7 per second
const mean = 1 / rate; // mean gap ≈ 0.6s

/** Same loop the real engine uses: keep sampling exponential gaps until the minute is up. */
function arrivals(seed: number): number[] {
  const rng = createRng(seed);
  const out: number[] = [];
  let t = 0;
  while ((t += exp(rng, mean)) <= DURATION) out.push(t);
  return out;
}

/** Inter-arrival gaps from a list of absolute arrival times. */
function gaps(times: number[]): number[] {
  const g: number[] = [];
  let prev = 0;
  for (const t of times) {
    g.push(t - prev);
    prev = t;
  }
  return g;
}

const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

// ── The experiment: one minute at ~1.7/sec, seed 42 ───────────────────────────
const seed = 42;
const ts = arrivals(seed);
const g = gaps(ts);

console.log(`Seed ${seed}: ${ts.length} arrivals over ${DURATION}s (expected ~${Math.round(rate * DURATION)})`);
console.log(`First 8 gaps (s): ${g.slice(0, 8).map((x) => round(x)).join(", ")}`);

const min = Math.min(...g);
const max = Math.max(...g);
const avg = g.reduce((a, b) => a + b, 0) / g.length;
console.log(`Gap min/mean/max: ${round(min)} / ${round(avg)} / ${round(max)}   (mean target ${round(mean)})`);

// Coarse histogram — exponential is right-skewed: many small gaps, a long thin tail.
const buckets = [
  { label: "<0.2 ", lo: 0, hi: 0.2 },
  { label: "0.2-0.6", lo: 0.2, hi: 0.6 },
  { label: "0.6-1.2", lo: 0.6, hi: 1.2 },
  { label: ">1.2 ", lo: 1.2, hi: Infinity },
];
console.log("Gap distribution:");
for (const b of buckets) {
  const n = g.filter((x) => x >= b.lo && x < b.hi).length;
  console.log(`  ${b.label.padEnd(7)} | ${"█".repeat(n)} ${n}`);
}

// ── Determinism check (the Module 1 property, now for arrivals) ────────────────
const a1 = arrivals(42);
const a2 = arrivals(42);
const identical = a1.length === a2.length && a1.every((v, i) => v === a2[i]);
const different = arrivals(7).length; // a different seed → a different stream

console.log(`\nDeterminism: seed 42 twice → ${identical ? "IDENTICAL ✓ (PASS)" : "DIFFERS ✗ (FAIL)"}`);
console.log(`Different seed (7) → ${different} arrivals (vs ${a1.length} for seed 42)`);
