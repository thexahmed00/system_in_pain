/* Deterministic seeded RNG. No Math.random / Date.now anywhere in the engine —
   same seed → same sequence, on client and Node. Threaded explicitly through
   every random draw (never a module-global). */

export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Exponential sample with the given mean (for Poisson inter-arrival + jitter). */
export const exp = (rng: Rng, mean: number): number => (mean <= 0 ? 0 : -mean * Math.log(1 - rng()));
