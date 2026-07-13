"use client";

import * as React from "react";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { progressHydrated } from "@/app/store/progress.slice";
import { loadProgress, saveProgress } from "@/app/lib/progress-storage";

/** Reads localStorage into the store on mount, then keeps localStorage in sync
    with every change. Split from Providers so it can use store hooks (must render
    inside <Provider>). No UI — this only exists to bridge Redux and localStorage. */
export function ProgressSync() {
  const dispatch = useAppDispatch();
  const { hydrated, byLevelId } = useAppSelector((s) => s.progress);

  React.useEffect(() => {
    dispatch(progressHydrated(loadProgress()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (hydrated) saveProgress(byLevelId);
  }, [hydrated, byLevelId]);

  return null;
}
