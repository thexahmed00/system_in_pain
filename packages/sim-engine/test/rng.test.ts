import { describe, it, expect } from "vitest";
import { createRng, exp } from "../src/rng/mulberry32";

const seq = (seed: number, n = 8) => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng());
};

describe("seeded RNG", () => {
  it("same seed → identical sequence", () => {
    expect(seq(42)).toEqual(seq(42));
  });

  it("different seed → different sequence", () => {
    expect(seq(42)).not.toEqual(seq(43));
  });

  it("produces values in [0, 1)", () => {
    for (const v of seq(7, 100)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("exp() is deterministic and non-negative", () => {
    const a = createRng(1);
    const b = createRng(1);
    expect(exp(a, 50)).toBe(exp(b, 50));
    expect(exp(createRng(2), 50)).toBeGreaterThanOrEqual(0);
  });
});
