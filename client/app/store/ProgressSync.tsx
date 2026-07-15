"use client";

import * as React from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { progressHydrated, type LevelProgress } from "@/app/store/progress.slice";
import { loadProgress, saveProgress } from "@/app/lib/progress-storage";
import { mergeProgress } from "@/app/lib/progress-merge";

/** Reads localStorage into the store on mount, then keeps localStorage in sync
    with every change. Split from Providers so it can use store hooks (must render
    inside <Provider>). No UI — this only exists to bridge Redux and localStorage.

    Once logged in, also merges in server-side progress (GET /api/progress) so
    progress actually follows the account across devices — the promise the login
    gate makes — and pushes back any locally-ahead levels (e.g. Level 1, played
    as a guest before the account existed) so the server catches up too. */
export function ProgressSync() {
  const dispatch = useAppDispatch();
  const { hydrated, byLevelId } = useAppSelector((s) => s.progress);
  const { user } = useUser();
  const syncedForUser = React.useRef<string | null>(null);

  React.useEffect(() => {
    dispatch(progressHydrated(loadProgress()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (hydrated) saveProgress(byLevelId);
  }, [hydrated, byLevelId]);

  React.useEffect(() => {
    if (!hydrated || !user?.sub || syncedForUser.current === user.sub) return;
    syncedForUser.current = user.sub;

    (async () => {
      let remote: Record<string, LevelProgress> = {};
      try {
        const res = await fetch("/api/progress");
        if (res.ok) remote = ((await res.json()) as { byLevelId: Record<string, LevelProgress> }).byLevelId;
      } catch {
        return; // offline/error — keep local progress as-is, try again next login
      }

      const merged = mergeProgress(byLevelId, remote);
      dispatch(progressHydrated(merged));

      // push any level where local beats the server's copy (or the server has no
      // copy at all), so a first login — or a device that was ahead — catches the
      // server up. Compare values, not object identity: mergeProgress always
      // returns a fresh object even when local and remote already tie.
      for (const [levelId, local] of Object.entries(merged)) {
        const server = remote[levelId];
        const localIsAhead =
          !server ||
          local.bestScore > server.bestScore ||
          local.starsEarned > server.starsEarned ||
          (local.passed && !server.passed);
        if (localIsAhead) {
          fetch("/api/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              levelId,
              score: local.bestScore,
              starsEarned: local.starsEarned,
              starsTotal: local.starsTotal,
            }),
          }).catch(() => {});
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, user?.sub]);

  return null;
}
