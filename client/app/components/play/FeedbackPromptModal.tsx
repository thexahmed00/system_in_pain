
"use client";

import * as React from "react";
import { motion } from "motion/react";
import { MessageCircle, Send, X } from "lucide-react";
import { spring } from "@/app/lib/motion";
import { Button } from "@/app/components/ui/Button";
import posthog from "posthog-js";

export interface FeedbackPromptModalProps {
  onDismiss: () => void;
}

/** A one-time, non-blocking nudge for feedback after passing Level 3 — a corner
    card, not a full-screen gate, so it never stands between the player and the
    next level (unlike LoginGateModal, which is intentionally a hard door). */
export function FeedbackPromptModal({ onDismiss }: FeedbackPromptModalProps) {
  const [message, setMessage] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent">("idle");

  async function submit() {
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, source: "level-3-prompt" }),
      });
      posthog.capture("feedback_submitted", { source: "level-3-prompt" });
    } catch {
      // best-effort — don't block the player over a failed nudge
    }
    setStatus("sent");
    setTimeout(onDismiss, 1400);
  }

  return (
    <motion.div
      className="fixed bottom-4 right-4 z-40 w-full max-w-sm sm:bottom-6 sm:right-6"
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={spring.pop}
    >
      <div className="relative rounded-[var(--radius-lg)] border border-line-strong bg-surface p-5 shadow-pop">
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute right-3 top-3 grid size-6 place-items-center rounded-md text-muted transition-colors hover:bg-paper-sunken hover:text-ink"
        >
          <X size={14} />
        </button>

        {status === "sent" ? (
          <p className="pr-6 text-sm font-medium text-ink">Thanks — that helps a lot.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 pr-6">
              <MessageCircle size={16} className="text-brand" />
              <p className="font-display text-sm font-bold text-ink">Three levels in — how&apos;s it going?</p>
            </div>
            <textarea
              autoFocus
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Anything confusing, broken, or that you liked?"
              className="mt-3 w-full rounded-[var(--radius-md)] border border-line-strong bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
            <div className="mt-3 flex items-center justify-between gap-2">
              <button onClick={onDismiss} className="text-xs font-medium text-muted hover:text-ink-soft">
                No thanks
              </button>
              <Button variant="primary" size="sm" onClick={submit} disabled={!message.trim() || status === "sending"}>
                <Send size={14} /> Send
              </Button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
