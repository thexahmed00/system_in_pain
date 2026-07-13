"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Check, X, ArrowRight, RotateCcw, Star, Circle, PartyPopper } from "lucide-react";
import { spring } from "@/app/lib/motion";
import { Button } from "@/app/components/ui/Button";
import { InfoTip } from "@/app/components/ui/InfoTip";
import { GLOSSARY } from "@/app/lib/glossary";
import { DIM_LABELS, dimColor } from "@/app/lib/sim-display";
import type { SimResult, Level } from "@sdq/sim-engine";
import posthog from "posthog-js";

const STAR_GOLD = "#e0a106";

// deterministic confetti pieces (no hydration drift)
const CONFETTI = Array.from({ length: 16 }, (_, i) => {
  const colors = ["var(--brand)", "var(--healthy)", "var(--load)", STAR_GOLD, "#e95d8a"];
  return { x: (i * 53) % 100, color: colors[i % colors.length], delay: (i % 5) * 0.04, rise: 80 + ((i * 17) % 60), rot: ((i * 73) % 360) - 180 };
});

export interface ResultModalProps {
  result: SimResult;
  level: Level;
  levelNumber: number;
  isLast: boolean;
  onNext: () => void;
  onReplay: () => void;
  onClose: () => void;
}

/** Shown after every graded run — passed or not. Both cases share the same
    metrics/dimension breakdown so a failed attempt is a diagnosis, not just a stop sign. */
export function ResultModal({ result, level, levelNumber, isLast, onNext, onReplay, onClose }: ResultModalProps) {
  const passed = result.passed;
  const stars = result.stars;
  const earned = stars.filter((s) => s.earned).length;
  const total = stars.length;
  const mastered = passed && earned === total;
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
        {/* confetti — only on a genuine pass, and only the celebratory amount when fully mastered */}
        {passed && (
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
        )}

        {/* status badge */}
        <motion.div
          className="mx-auto grid size-16 place-items-center rounded-full"
          style={{ background: `color-mix(in srgb, var(${passed ? "--healthy" : "--bottleneck"}) 16%, var(--surface))` }}
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring.pop, delay: 0.08 }}
        >
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring.pop, delay: 0.2 }}>
            {passed ? (
              <Check size={34} strokeWidth={3} style={{ color: "var(--healthy)" }} />
            ) : (
              <X size={34} strokeWidth={3} style={{ color: "var(--bottleneck)" }} />
            )}
          </motion.span>
        </motion.div>

        <p className="mt-4 text-[11px] font-bold tracking-[0.2em] text-muted">
          {passed ? `LEVEL ${levelNumber} COMPLETE` : `LEVEL ${levelNumber} · NOT PASSED`}
        </p>
        <h2 className="mt-1 font-display text-2xl font-extrabold text-ink">
          {passed ? `${level.title} solved` : `${level.title} — not quite`}
        </h2>

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
          {earned}/{total} stars · <span className="tabular" style={{ color: passed ? "var(--healthy)" : "var(--bottleneck)" }}>{result.final}</span> pts
        </p>

        {/* same metrics + dimension breakdown as the in-canvas result panel — on a
            failed run this doubles as the diagnosis, not just the scoreboard */}
        <div className="mt-5 text-left">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["p99", `${result.metrics.p99}ms`, GLOSSARY.p99Latency],
                ["avail", `${(result.metrics.availability * 100).toFixed(1)}%`, GLOSSARY.availability],
                ["cost", `$${result.metrics.costPerHour}/hr`, GLOSSARY.cost],
                ["tps", `${Math.round(result.metrics.throughput)}r/s`, GLOSSARY.throughput],
              ] as [string, string, string][]
            ).map(([k, v, tip]) => (
              <div key={k} className="rounded-[var(--radius-md)] bg-paper-sunken px-2 py-1.5">
                <div className="label-spec flex items-center gap-1">{k}<InfoTip text={tip} /></div>
                <div className="tabular text-sm font-bold text-ink">{v}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {DIM_LABELS.map(([k, label]) => {
              const active = result.activeDimensions.includes(k);
              return (
                <div key={k} className={active ? "" : "opacity-40"}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-ink-soft">
                      {label}<InfoTip text={GLOSSARY[k]} />
                      {!active && <span className="ml-1 text-[10px] text-muted">not tested</span>}
                    </span>
                    <span className="tabular font-semibold text-ink">{active ? result.dims[k] : "—"}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-paper-sunken">
                    {active && (
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${result.dims[k]}%`, background: dimColor(result.dims[k]) }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {result.lesson && (
            <p className="mt-4 rounded-r-[var(--radius-md)] border-l-[3px] border-load bg-load-soft/60 px-3 py-2.5 text-sm text-ink-soft">
              {result.lesson}
            </p>
          )}
        </div>

        {/* challenge checklist — bonus goals, only worth showing once the level is actually passed */}
        {passed && (
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
        )}

        {passed && !mastered && nextStar && (
          <p className="mt-3 text-xs text-muted">One more star: <span className="font-semibold text-ink-soft">{nextStar.hint}</span> — hit Replay to chase it.</p>
        )}

        <div className="mt-6 flex gap-3">
          {passed ? (
            <>
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
            </>
          ) : (
            <>
              <Link href="/levels" className="flex-1">
                <Button variant="secondary" className="w-full">Back to levels</Button>
              </Link>
              <Button variant="primary" className="flex-1" onClick={() => {
                posthog.capture("level_retry_clicked", {
                  level_number: levelNumber,
                  level_title: level.title,
                  score: result.final,
                });
                onReplay();
              }}>
                <RotateCcw size={16} /> Try again
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
