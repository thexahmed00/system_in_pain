import type { LevelProgress } from "@/app/store/progress.slice";

/** Best of two records for the same level — used to merge local (localStorage)
    progress with server (Supabase) progress on login, in either direction, so
    neither side ever regresses the other. */
export function betterOf(a?: LevelProgress, b?: LevelProgress): LevelProgress | undefined {
  if (!a) return b;
  if (!b) return a;
  return {
    passed: a.passed || b.passed,
    bestScore: Math.max(a.bestScore, b.bestScore),
    starsEarned: Math.max(a.starsEarned, b.starsEarned),
    starsTotal: Math.max(a.starsTotal, b.starsTotal),
  };
}

export function mergeProgress(
  a: Record<string, LevelProgress>,
  b: Record<string, LevelProgress>,
): Record<string, LevelProgress> {
  const merged: Record<string, LevelProgress> = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const m = betterOf(a[id], b[id]);
    if (m) merged[id] = m;
  }
  return merged;
}
