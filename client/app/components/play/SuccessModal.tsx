"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Check, ArrowRight, RotateCcw, Star, Circle, PartyPopper } from "lucide-react";
import { spring } from "@/app/lib/motion";
import { Button } from "@/app/components/ui/Button";
import type { SimResult, Level } from "@sdq/sim-engine";
import posthog from "posthog-js";

const STAR_GOLD = "#e0a106";

// deterministic confetti pieces (no hydration drift)
const CONFETTI = Array.from({ length: 16 }, (_, i) => {
  const colors = ["var(--brand)", "var(--healthy)", "var(--load)", STAR_GOLD, "#e95d8a"];
  return { x: (i * 53) % 100, color: colors[i % colors.length], delay: (i % 5) * 0.04, rise: 80 + ((i * 17) % 60), rot: ((i * 73) % 360) - 180 };
});

export interface SuccessModalProps {
  result: SimResult;
  level: Level;
  levelNumber: number;
  isLast: boolean;
  onNext: () => void;
  onReplay: () => void;
  onClose: () => void;
}

export function SuccessModal({ result, level, levelNumber, isLast, onNext, onReplay, onClose }: SuccessModalProps) {
  const stars = result.stars;
  const earned = stars.filter((s) => s.earned).length;
  const total = stars.length;
  const mastered = earned === total;
  const nextStar = stars.find((s) => !s.earned);

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative w-full max-w-md overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface p-8 text-center shadow-2xl"
        initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={spring.pop}
      >
        {/* confetti (only the celebratory amount when fully mastered) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0">
          {CONFETTI.slice(0, mastered ? 16 : 8).map((c, i) => (
            <motion.span
              key={i}
              className="absolute top-0 size-2 rounded-[2px]"
              style={{ left: `${c.x}%`, background: c.color }}
              initial={{ y: 24, opacity: 0, rotate: 0 }}
              animate={{ y: [24, -c.rise, 160], opacity: [0, 1, 0], rotate: c.rot }}
              transition={{ duration: 1.1, delay: 0.15 + c.delay, ease: "easeOut" }}
            />
          ))}
        </div>

        {/* check badge */}
        <motion.div
          className="mx-auto grid size-16 place-items-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--healthy) 16%, var(--surface))" }}
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring.pop, delay: 0.08 }}
        >
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring.pop, delay: 0.2 }}>
            <Check size={34} strokeWidth={3} style={{ color: "var(--healthy)" }} />
          </motion.span>
        </motion.div>

        <p className="mt-4 text-[11px] font-bold tracking-[0.2em] text-muted">LEVEL {levelNumber} COMPLETE</p>
        <h2 className="mt-1 font-display text-2xl font-extrabold text-ink">{level.title} solved</h2>

        {/* stars */}
        <div className="mt-5 flex items-center justify-center gap-3">
          {stars.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ scale: 0, rotate: -35 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ ...spring.pop, delay: 0.35 + i * 0.14 }}
            >
              <Star size={38} strokeWidth={2} style={{ color: s.earned ? STAR_GOLD : "var(--line-strong)", fill: s.earned ? STAR_GOLD : "transparent" }} />
            </motion.div>
          ))}
        </div>
        <p className="mt-2 text-sm font-semibold text-ink-soft">
          {earned}/{total} stars · <span className="tabular" style={{ color: "var(--healthy)" }}>{result.final}</span> pts
        </p>

        {/* challenge checklist (the two beyond Solved) */}
        <div className="mt-4 space-y-1.5 rounded-[var(--radius-md)] bg-paper-sunken px-4 py-3 text-left">
          {stars.slice(1).map((s) => (
            <div key={s.id} className="flex items-start gap-2 text-sm">
              {s.earned ? (
                <Check size={15} className="mt-0.5 shrink-0" style={{ color: STAR_GOLD }} />
              ) : (
                <Circle size={15} className="mt-0.5 shrink-0 text-muted" />
              )}
              <span className={s.earned ? "font-semibold text-ink" : "text-muted"}>
                {s.label}
                {!s.earned && <span className="font-normal"> — {s.hint}</span>}
              </span>
            </div>
          ))}
        </div>

        {!mastered && nextStar && (
          <p className="mt-3 text-xs text-muted">One more star: <span className="font-semibold text-ink-soft">{nextStar.hint}</span> — hit Replay to chase it.</p>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => {
            posthog.capture("level_replay_clicked", {
              level_number: levelNumber,
              level_title: level.title,
              stars_earned: earned,
              stars_total: total,
              score: result.final,
            });
            onReplay();
          }}>
            <RotateCcw size={16} /> Replay
          </Button>
          {isLast ? (
            <Button variant="primary" className="flex-1" onClick={onClose}>
              <PartyPopper size={16} /> All done
            </Button>
          ) : (
            <Button variant="primary" className="flex-1" onClick={() => {
              posthog.capture("level_next_clicked", {
                level_number: levelNumber,
                level_title: level.title,
                stars_earned: earned,
                stars_total: total,
                score: result.final,
              });
              onNext();
            }}>
              Next problem <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
