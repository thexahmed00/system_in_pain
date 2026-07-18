"use client";

import * as React from "react";
import { motion } from "motion/react";
import { MessageCircle, Send } from "lucide-react";
import { spring } from "@/app/lib/motion";
import { Button } from "@/app/components/ui/Button";
import posthog from "posthog-js";

export interface FeedbackPromptModalProps {
  onDismiss: () => void;
  levelNumber: number;
}

/** A recurring, dismissible nudge for feedback — re-arms every few levels for
    an engaged player (see feedback-prompt-storage.ts). Centered like the other
    play-screen modals (LoginGateModal, ResultModal), but always skippable —
    unlike LoginGateModal, which is intentionally a hard door. */
export function FeedbackPromptModal({ onDismiss, levelNumber }: FeedbackPromptModalProps) {
  const [message, setMessage] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent">("idle");

  async function submit() {
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, source: `level-${levelNumber}-prompt` }),
      });
      posthog.capture("feedback_submitted", { source: `level-${levelNumber}-prompt` });
    } catch {
      // best-effort — don't block the player over a failed nudge
    }
    setStatus("sent");
    setTimeout(onDismiss, 1400);
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onDismiss} />

      <motion.div
        className="relative w-full max-w-sm overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-2xl"
        initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={spring.pop}
      >
        {status === "sent" ? (
          <p className="py-4 text-center text-sm font-medium text-ink">Thanks — that helps a lot.</p>
        ) : (
          <>
            <div
              className="mx-auto grid size-14 place-items-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--brand) 16%, var(--surface))" }}
            >
              <MessageCircle size={26} className="text-brand" />
            </div>
            <p className="mt-4 text-center font-display text-lg font-bold text-ink">
              Level {levelNumber} in — how&apos;s it going?
            </p>
            <textarea
              autoFocus
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Anything confusing, broken, or that you liked?"
              className="mt-4 w-full rounded-[var(--radius-md)] border border-line-strong bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
            <div className="mt-4 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={onDismiss}>
                No thanks
              </Button>
              <Button variant="primary" className="flex-1" onClick={submit} disabled={!message.trim() || status === "sending"}>
                <Send size={14} /> Send
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
