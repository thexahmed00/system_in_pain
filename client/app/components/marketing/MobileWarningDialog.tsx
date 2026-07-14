"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { MonitorSmartphone } from "lucide-react";
import { spring } from "@/app/lib/motion";
import { Button } from "@/app/components/ui/Button";
import { useIsMobile } from "@/app/lib/use-is-mobile";

const DISMISS_KEY = "sdq.mobile-warning-dismissed.v1";

export function MobileWarningDialog() {
  const isMobile = useIsMobile();
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      // ignore — private mode just means we'll ask again next reload
    }
  }, []);

  const visible = isMobile && !dismissed;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[60] grid place-items-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />

          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface p-8 text-center shadow-2xl"
            initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={spring.pop}
          >
            <div
              className="mx-auto grid size-16 place-items-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--brand) 16%, var(--surface))" }}
            >
              <MonitorSmartphone size={32} style={{ color: "var(--brand)" }} />
            </div>

            <h2 className="mt-4 font-display text-xl font-extrabold text-ink">Best on a bigger screen</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              systemInPain's canvas is drag-and-drop architecture building — it needs room to
              breathe. Please switch to a desktop or a wider window for the full experience.
            </p>

            <Button variant="secondary" className="mt-6 w-full" onClick={dismiss}>
              Continue anyway
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
