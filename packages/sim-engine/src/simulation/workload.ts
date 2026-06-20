import type { RequestClass } from "../types";
import type { Rng } from "../rng/mulberry32";

/* Decides the nature of each request, using the repeatable dice.

   - read vs write: split by the level's readWriteRatio (0.9 = 90% reads).
   - cache hit vs miss: only reads can hit a cache, and only with probability
     hitRatio. A hit is satisfied at the cache; a miss falls through to storage.
     Writes never hit — they must reach storage. This is what makes a cache
     useless for write-heavy workloads. */

/** read if the dice land under the read fraction, else write */
export function classifyRequest(rng: Rng, readWriteRatio: number): RequestClass {
  return rng() < readWriteRatio ? "read" : "write";
}

/** true if this request is served straight from the cache (read + lucky) */
export function cacheHit(rng: Rng, hitRatio: number, cls: RequestClass): boolean {
  if (cls !== "read") return false;
  return rng() < hitRatio;
}
