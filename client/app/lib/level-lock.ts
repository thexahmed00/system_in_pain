import { LEVELS } from "@/app/play/level-data";
import type { LevelProgress } from "@/app/store/progress.slice";

/** Level 1 is always open; every level after that unlocks once the previous one
    is passed AND the player is logged in (an Auth0 session — Level 2+ is gated
    on account creation). Shared by /levels (the select grid) and /play
    (in-canvas nav). */
export function isLevelUnlocked(index: number, byLevelId: Record<string, LevelProgress>, loggedIn: boolean): boolean {
  if (index <= 0) return true;
  if (index >= LEVELS.length) return false;
  if (!loggedIn) return false;
  const prev = LEVELS[index - 1];
  return !!byLevelId[prev.id]?.passed;
}

/** True when a level's only remaining lock is "not logged in" — i.e. progress
    alone would unlock it. Used to show "Log in to continue" instead of a plain
    "Locked" state. */
export function needsLogin(index: number, byLevelId: Record<string, LevelProgress>, loggedIn: boolean): boolean {
  if (loggedIn || index <= 0 || index >= LEVELS.length) return false;
  const prev = LEVELS[index - 1];
  return !!byLevelId[prev.id]?.passed;
}

/** Highest index reachable given current progress — used to clamp a deep link
    into a level the player hasn't unlocked yet. */
export function highestUnlockedIndex(byLevelId: Record<string, LevelProgress>, loggedIn: boolean): number {
  let i = 0;
  while (i + 1 < LEVELS.length && isLevelUnlocked(i + 1, byLevelId, loggedIn)) i++;
  return i;
}
