"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { LogIn, PartyPopper } from "lucide-react";
import { spring } from "@/app/lib/motion";
import { Button } from "@/app/components/ui/Button";

export interface LoginGateModalProps {
  returnTo: string;
}

/** Shown instead of advancing past Level 1 when the player has no Auth0 session.
    Levels 2+ require an account — this is the one and only door, no skip. */
export function LoginGateModal({ returnTo }: LoginGateModalProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />

      <motion.div
        className="relative w-full max-w-md overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface p-8 text-center shadow-2xl"
        initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={spring.pop}
      >
        <motion.div
          className="mx-auto grid size-16 place-items-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--brand) 16%, var(--surface))" }}
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring.pop, delay: 0.08 }}
        >
          <PartyPopper size={32} style={{ color: "var(--brand)" }} />
        </motion.div>

        <p className="mt-4 text-[11px] font-bold tracking-[0.2em] text-muted">LEVEL 1 COMPLETE</p>
        <h2 className="mt-1 font-display text-2xl font-extrabold text-ink">Create a free account to continue</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Levels 2 and up need an account — it's how your progress and scores stay
          tied to you instead of just this browser.
        </p>

        <div className="mt-6 flex gap-3">
          <Link href="/levels" className="flex-1">
            <Button variant="secondary" className="w-full">Back to levels</Button>
          </Link>
          <Link href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`} className="flex-1">
            <Button variant="primary" className="w-full"><LogIn size={16} /> Log in</Button>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
