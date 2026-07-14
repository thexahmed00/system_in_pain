"use client";

import Link from "next/link";
import { ArrowLeft, MonitorSmartphone } from "lucide-react";
import { Button } from "@/app/components/ui/Button";

/** Blocks gameplay on small screens — the canvas relies on native HTML5
    drag-and-drop to place components, which doesn't work on touch at all,
    so there's no usable fallback layout to fall back to. No dismiss. */
export function MobileGuard() {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-paper p-6 text-center">
      <div className="mx-auto max-w-xs">
        <div
          className="mx-auto grid size-16 place-items-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--brand) 16%, var(--surface))" }}
        >
          <MonitorSmartphone size={32} style={{ color: "var(--brand)" }} />
        </div>

        <h1 className="mt-4 font-display text-xl font-extrabold text-ink">Open this on a desktop</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Building architectures uses drag-and-drop and needs real screen space — it doesn't
          work on a phone. Switch to a laptop or desktop browser to play.
        </p>

        <Link href="/levels" className="mt-6 inline-flex">
          <Button variant="secondary"><ArrowLeft size={16} /> Back to levels</Button>
        </Link>
      </div>
    </div>
  );
}
