import type { LevelProgress } from "@/app/store/progress.slice";

const KEY = "sdq.progress.v1";

/** localStorage can throw (private mode, SSR, disabled storage) — never let progress break the app. */
export function loadProgress(): Record<string, LevelProgress> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, LevelProgress>) : {};
  } catch {
    return {};
  }
}

export function saveProgress(byLevelId: Record<string, LevelProgress>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(byLevelId));
  } catch {
    // storage full/disabled — progress just won't persist this session
  }
}
