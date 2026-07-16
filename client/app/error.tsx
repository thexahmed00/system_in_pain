"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import posthog from "posthog-js";
import { Button } from "@/app/components/ui/Button";

/** Root error boundary — catches any uncaught throw in a page/segment (e.g. the
    sim engine choking on an unusual graph during a run) so it shows a recovery
    screen instead of a blank white page. Reports to PostHog so a production
    crash is actually visible instead of just silently losing the visitor. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-paper p-6 text-center">
      <div className="mx-auto max-w-sm">
        <div
          className="mx-auto grid size-16 place-items-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--bottleneck) 16%, var(--surface))" }}
        >
          <AlertTriangle size={32} style={{ color: "var(--bottleneck)" }} />
        </div>
        <h1 className="mt-4 font-display text-xl font-extrabold text-ink">Something broke</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          That&apos;s on us, not your architecture. Try again — if it keeps happening, tell us what you were building.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/" className="flex-1">
            <Button variant="secondary" className="w-full"><Home size={16} /> Home</Button>
          </Link>
          <Button variant="primary" className="flex-1" onClick={() => reset()}>
            <RotateCcw size={16} /> Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
