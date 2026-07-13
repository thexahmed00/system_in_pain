"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, Lock, Star, Zap } from "lucide-react";
import { Card, CardTitle, Badge, Button } from "@/app/components/ui";
import { LEVELS } from "@/app/play/level-data";
import { isLevelUnlocked } from "@/app/lib/level-lock";
import { useAppSelector } from "@/app/store/hooks";
import { stagger, fadeRise, popIn } from "@/app/lib/motion";

export default function LevelsPage() {
  const hydrated = useAppSelector((s) => s.progress.hydrated);
  const byLevelId = useAppSelector((s) => s.progress.byLevelId);
  const passedCount = Object.values(byLevelId).filter((p) => p.passed).length;

  return (
    <div className="relative min-h-screen bg-paper">
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-blueprint opacity-[0.5]" />

      <header className="relative z-10 mx-auto flex max-w-8xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-ink">
          <span className="text-muted transition-colors hover:text-ink"><ArrowLeft size={18} /></span>
          <span className="grid size-7 place-items-center rounded-lg bg-brand text-white shadow-pop-brand">
            <Zap size={16} fill="currentColor" />
          </span>
          systemInPain<span className="text-brand">.com</span>
        </Link>
        <Badge tone="brand" dot>{passedCount}/{LEVELS.length} passed</Badge>
      </header>

      <motion.section
        variants={stagger(0.08)} initial="hidden" animate="show"
        className="relative z-10 mx-auto max-w-8xl px-6 pb-24 pt-6"
      >
        <motion.div variants={fadeRise} className="mb-10 max-w-xl">
          <h1 className="font-display text-4xl font-extrabold leading-tight text-ink">Choose a level.</h1>
          <p className="mt-3 text-ink-soft">
            Each level is a real system under real traffic. Pass one to unlock the next —
            the curriculum builds on itself, one concept at a time.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LEVELS.map((level, i) => {
            const unlocked = !hydrated || isLevelUnlocked(i, byLevelId);
            const p = byLevelId[level.id];
            const card = (
              <Card
                interactive={unlocked}
                className={`h-full transition-opacity ${unlocked ? "" : "opacity-60"}`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <span className="tabular text-2xl font-extrabold text-brand/25">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {p?.passed ? (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: p.starsTotal }).map((_, si) => (
                        <Star
                          key={si}
                          size={14}
                          strokeWidth={2}
                          style={{ color: si < p.starsEarned ? "#e0a106" : "var(--line-strong)", fill: si < p.starsEarned ? "#e0a106" : "transparent" }}
                        />
                      ))}
                    </div>
                  ) : !unlocked ? (
                    <Lock size={16} className="text-muted" />
                  ) : null}
                </div>

                <CardTitle>{level.title}</CardTitle>
                <p className="mt-1.5 line-clamp-2 text-sm text-muted">{level.story}</p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {level.concepts.slice(0, 2).map((c) => (
                    <Badge key={c} tone="neutral" className="!text-[10px]">{c}</Badge>
                  ))}
                </div>

                <div className="mt-5">
                  {unlocked ? (
                    <Button variant={p?.passed ? "secondary" : "primary"} size="sm" className="w-full">
                      {p?.passed ? "Replay" : "Play"}
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" className="w-full" disabled>
                      <Lock size={13} /> Locked
                    </Button>
                  )}
                </div>
              </Card>
            );

            return (
              <motion.div key={level.id} variants={popIn}>
                {unlocked ? (
                  <Link href={`/play?level=${level.id}`} className="block h-full" aria-label={`Play ${level.title}`}>
                    {card}
                  </Link>
                ) : (
                  <div className="h-full cursor-not-allowed" aria-label={`${level.title} — locked`}>
                    {card}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.section>
    </div>
  );
}
