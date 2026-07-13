import { configureStore } from "@reduxjs/toolkit";
import architecture from "./architecture.slice";
import sim from "./sim.slice";
import progress from "./progress.slice";

export const makeStore = () =>
  configureStore({
    reducer: { architecture, sim, progress },
    middleware: (getDefault) =>
      // React Flow nodes/edges carry non-plain bits; skip the serializable check.
      getDefault({ serializableCheck: false }),
  });

export const store = makeStore();
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
