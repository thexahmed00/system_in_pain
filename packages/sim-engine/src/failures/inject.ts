import type { FailureInjection } from "../types";

/* The disaster schedule. The simulator asks these as the clock advances; each
   disaster only counts while it is active (atSecond ≤ t < atSecond+durationSec),
   so the system recovers once a disaster's window passes. */

const active = (f: FailureInjection, t: number) => t >= f.atSecond && t < f.atSecond + f.durationSec;

/** How much heavier is traffic at time t (product of any active spikes; 1 = normal). */
export function trafficMultiplierAt(injections: FailureInjection[], t: number): number {
  let m = 1;
  for (const f of injections) if (f.kind === "spike" && active(f, t)) m *= f.multiplier;
  return m;
}

/** Is every box of this type currently crashed at time t? */
export function isTypeDownAt(injections: FailureInjection[], nodeType: string, t: number): boolean {
  return injections.some((f) => f.kind === "node-down" && f.nodeType === nodeType && active(f, t));
}

/** Extra network latency (ms) to add to a hop at time t (sum of active latency spikes). */
export function extraLatencyMsAt(injections: FailureInjection[], t: number): number {
  let add = 0;
  for (const f of injections) if (f.kind === "latency-spike" && active(f, t)) add += f.addMs;
  return add;
}
