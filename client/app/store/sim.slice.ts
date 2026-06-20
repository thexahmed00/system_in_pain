import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SimResult } from "@sdq/sim-engine";

/** Simulation run state. `result` is server-truth once the real engine lands. */
interface SimState {
  running: boolean;
  result: SimResult | null;
}

const initialState: SimState = { running: false, result: null };

const slice = createSlice({
  name: "sim",
  initialState,
  reducers: {
    runStarted(state) {
      state.running = true;
    },
    runFinished(state, a: PayloadAction<SimResult>) {
      state.running = false;
      state.result = a.payload;
    },
    simCleared(state) {
      state.result = null;
      state.running = false;
    },
  },
});

export const { runStarted, runFinished, simCleared } = slice.actions;
export default slice.reducer;
