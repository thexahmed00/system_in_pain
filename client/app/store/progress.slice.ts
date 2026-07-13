import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** Best result recorded for a level, persisted to localStorage (see progress-storage.ts). */
export interface LevelProgress {
  passed: boolean;
  bestScore: number;
  starsEarned: number;
  starsTotal: number;
}

interface ProgressState {
  /** false until the localStorage read completes — the /levels page waits on this
      so it doesn't flash "all locked" before hydration runs. */
  hydrated: boolean;
  byLevelId: Record<string, LevelProgress>;
}

const initialState: ProgressState = { hydrated: false, byLevelId: {} };

const slice = createSlice({
  name: "progress",
  initialState,
  reducers: {
    progressHydrated(state, a: PayloadAction<Record<string, LevelProgress>>) {
      state.byLevelId = a.payload;
      state.hydrated = true;
    },
    levelPassed(state, a: PayloadAction<{ levelId: string; score: number; starsEarned: number; starsTotal: number }>) {
      const { levelId, score, starsEarned, starsTotal } = a.payload;
      const prev = state.byLevelId[levelId];
      state.byLevelId[levelId] = {
        passed: true,
        bestScore: Math.max(prev?.bestScore ?? 0, score),
        starsEarned: Math.max(prev?.starsEarned ?? 0, starsEarned),
        starsTotal,
      };
    },
  },
});

export const { progressHydrated, levelPassed } = slice.actions;
export default slice.reducer;
