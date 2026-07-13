import { LEVELS } from "@/app/play/level-data";
import type { LevelProgress } from "@/app/store/progress.slice";

/** Level 1 is always open; every level after that unlocks once the previous one
    is passed. Shared by /levels (the select grid) and /play (in-canvas nav). */
export function isLevelUnlocked(index: number, byLevelId: Record<string, LevelProgress>): boolean {
  if (index <= 0) return true;
  if (index >= LEVELS.length) return false;
  const prev = LEVELS[index - 1];
  return !!byLevelId[prev.id]?.passed;
}

/** Highest index reachable given current progress — used to clamp a deep link
    into a level the player hasn't unlocked yet. */
export function highestUnlockedIndex(byLevelId: Record<string, LevelProgress>): number {
  let i = 0;
  while (i + 1 < LEVELS.length && isLevelUnlocked(i + 1, byLevelId)) i++;
  return i;
}
