"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Hammer, Activity, Eye, Sparkles, ArrowRight, Zap } from "lucide-react";
import { Button, Card, Badge } from "@/app/components/ui";
import posthog from "posthog-js";
import { stagger, fadeRise, fade, popIn, spring } from "@/app/lib/motion";
import { StressTestHero } from "@/app/components/marketing/StressTestHero";
import { FailureMarquee } from "@/app/components/marketing/FailureMarquee";

const STEPS = [
  { icon: Hammer, title: "Build", body: "Drag components onto the canvas and wire a real architecture.", n: "01" },
  { icon: Activity, title: "Simulate", body: "Run live traffic through a deterministic engine — packets and all.", n: "02" },
  { icon: Eye, title: "Observe", body: "Watch nodes saturate, queues back up, bottlenecks turn red.", n: "03" },
  { icon: Sparkles, title: "Optimize", body: "Scored on latency, cost, resilience. Never on checkboxes.", n: "04" },
];

const STAGES = [
  { n: "01", name: "Foundations", ex: "URL Shortener · Blog · Todo" },
  { n: "02", name: "Scaling", ex: "Chat · Food Delivery · E-commerce" },
  { n: "03", name: "Distributed", ex: "WhatsApp · Instagram · Netflix" },
  { n: "04", name: "Enterprise", ex: "YouTube · Uber · Amazon" },
];

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-paper">
      {/* layered atmosphere: blueprint grid + grain + brand glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-blueprint opacity-[0.5]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grain opacity-[0.04] mix-blend-multiply" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-200px] h-[560px] opacity-60 blur-3xl"
        style={{ background: "radial-gradient(45% 60% at 60% 35%, color-mix(in srgb, var(--brand) 24%, transparent), transparent 70%)" }}
      />

      {/* nav */}
      <header className="relative z-10 mx-auto flex max-w-8xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-ink">
          <span className="grid size-7 place-items-center rounded-lg bg-brand text-white shadow-pop-brand">
            <Zap size={16} fill="currentColor" />
          </span>
          systemInPain<span className="text-brand">.com</span>
        </div>
        <Link href="/play" onClick={() => posthog.capture("play_cta_clicked", { location: "nav" })}><Button variant="secondary" size="sm">Open canvas</Button></Link>
      </header>

      {/* HERO — asymmetric, oversized wordmark left / live sim right */}
      <motion.section
        variants={stagger(0.09)} initial="hidden" animate="show"
        className="relative z-10 mx-auto grid max-w-[1600px] items-center gap-12 px-6 pb-16 pt-12 lg:grid-cols-[1.1fr_0.9fr]"
      >
        <div className="space-y-7">
          <motion.div variants={popIn} className="flex items-center gap-3">
            <Badge tone="brand" dot>Build · Break · Scale</Badge>
            <span className="label-spec">v1 · 5 levels live</span>
          </motion.div>

          {/* grid-breaking display lockup */}
          <motion.h1 variants={fadeRise} className="font-display font-extrabold leading-[0.86] tracking-tight text-ink">
            <span className="block text-[clamp(3rem,9vw,6.5rem)]">Is system<span className="text-brand"> In</span> Pain</span>
          </motion.h1>

          <motion.p variants={fadeRise} className="max-w-xl text-xl leading-relaxed text-ink-soft">
            Learn system design the painful way — the way that sticks.
            <span className="font-medium text-ink"> Build real systems, run traffic through them, and watch them break.</span>
          </motion.p>

          <motion.div variants={fadeRise} className="flex flex-wrap items-center gap-3 pt-1">
            <Link href="/play" onClick={() => posthog.capture("play_cta_clicked", { location: "hero_primary" })}><Button variant="primary" size="lg">Start playing <ArrowRight size={18} /></Button></Link>
            <Button variant="ghost" size="lg">See how it works</Button>
          </motion.div>

          <motion.p variants={fade} className="label-spec max-w-sm !normal-case">
            Deterministic simulator — same architecture, same result, every time. No signup.
          </motion.p>
        </div>

        {/* the signature: interactive stress test */}
        <motion.div variants={popIn} transition={spring.gentle} className="relative">
          <span className="label-spec absolute -top-5 right-1">↘ flip the scenario</span>
          <StressTestHero />
        </motion.div>
      </motion.section>

      {/* failure ticker — edge + atmosphere */}
      <div className="relative z-10 my-9"><FailureMarquee /></div>

      {/* HOW IT WORKS — numbered editorial cards */}
      <motion.section
        variants={stagger(0.07)} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}
        className="relative z-10 mx-auto max-w-8xl px-6 py-20"
      >
        <motion.div variants={fadeRise} className="mb-10 flex items-end justify-between gap-6">
          <h2 className="max-w-md font-display text-4xl font-extrabold leading-tight text-ink">
            Learning through cause &amp; effect.
          </h2>
          <p className="label-spec hidden shrink-0 sm:block">THE LOOP →</p>
        </motion.div>
        <div className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <motion.div key={s.title} variants={popIn} className="group bg-surface p-6 transition-colors hover:bg-paper">
              <div className="mb-5 flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-[var(--radius-md)] bg-brand-soft text-brand transition-transform group-hover:-translate-y-0.5">
                  <s.icon size={20} />
                </span>
                <span className="tabular text-2xl font-extrabold text-line-strong">{s.n}</span>
              </div>
              <h3 className="font-display text-lg font-bold text-ink">{s.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* STAGES */}
      <motion.section
        variants={stagger(0.06)} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}
        className="relative z-10 mx-auto max-w-8xl px-6 pb-20"
      >
        <motion.h2 variants={fadeRise} className="mb-10 font-display text-4xl font-extrabold text-ink">
          One server <span className="text-muted/50">→</span> planet scale.
        </motion.h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((st) => (
            <motion.div key={st.n} variants={popIn}>
              <Card interactive className="h-full">
                <span className="tabular text-3xl font-extrabold text-brand/25">{st.n}</span>
                <h3 className="mt-2 font-display text-lg font-bold text-ink">{st.name}</h3>
                <p className="mt-1 text-sm text-muted">{st.ex}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* FINAL CTA */}
      <section className="relative z-10 mx-auto max-w-8xl px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={spring.soft}
          className="relative overflow-hidden rounded-[var(--radius-xl)] bg-ink px-8 py-16 text-center"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40"
            style={{ background: "radial-gradient(40% 80% at 80% 0%, color-mix(in srgb, var(--brand) 60%, transparent), transparent 60%)" }} />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-grain opacity-[0.06]" />
          <div className="relative">
            <h2 className="font-display text-5xl font-extrabold tracking-tight text-white">Break your first system.</h2>
            <p className="mx-auto mt-3 max-w-md text-white/70">Five levels. A deterministic engine. Zero diagrams to memorize.</p>
            <Link href="/play" className="mt-8 inline-block" onClick={() => posthog.capture("play_cta_clicked", { location: "final_cta" })}><Button variant="primary" size="lg">Start playing <ArrowRight size={18} /></Button></Link>
          </div>
        </motion.div>
        <p className="label-spec mt-10 text-center">systemInPain.com — the Duolingo of system design</p>
      </section>
    </div>
  );
}
