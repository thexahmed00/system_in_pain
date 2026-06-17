"use client";

import { motion } from "motion/react";
import { Button, Card, CardTitle, CardKicker, Badge, MetricStat } from "@/app/components/ui";
import { stagger, fadeRise } from "@/app/lib/motion";

const swatches: { name: string; varName: string; ink?: boolean }[] = [
  { name: "paper", varName: "--paper", ink: true },
  { name: "surface", varName: "--surface", ink: true },
  { name: "ink", varName: "--ink" },
  { name: "brand", varName: "--brand" },
  { name: "healthy", varName: "--healthy" },
  { name: "load", varName: "--load" },
  { name: "bottleneck", varName: "--bottleneck" },
  { name: "fail", varName: "--fail" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section variants={fadeRise} className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">{title}</h2>
      {children}
    </motion.section>
  );
}

export default function DesignSystem() {
  return (
    <div className="min-h-screen bg-paper bg-dotgrid">
      <motion.main
        variants={stagger(0.08)}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-5xl px-6 py-16 space-y-14"
      >
        <motion.header variants={fadeRise} className="space-y-3">
          <Badge tone="brand" dot>
            Design System
          </Badge>
          <h1 className="text-5xl font-display font-extrabold tracking-tight text-ink">
            System Design Quest
          </h1>
          <p className="text-lg text-ink-soft max-w-xl">
            Soft technical playground — warm paper, tactile cards, cobalt brand. Sim-health
            colors stay loud, outside the brand ramp.
          </p>
        </motion.header>

        {/* Typography */}
        <Section title="Typography">
          <div className="space-y-2">
            <p className="font-display text-4xl font-extrabold text-ink">Bricolage Grotesque — display</p>
            <p className="font-sans text-xl text-ink-soft">Spline Sans — body copy, the workhorse for reading.</p>
            <p className="tabular text-xl text-ink">JetBrains Mono — p99 142ms · avail 99.4% · $5/hr</p>
          </div>
        </Section>

        {/* Palette */}
        <Section title="Palette">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {swatches.map((s) => (
              <div
                key={s.name}
                className="rounded-[var(--radius-md)] border border-line p-4 h-24 flex flex-col justify-between"
                style={{ background: `var(${s.varName})` }}
              >
                <span className={`text-xs font-semibold ${s.ink ? "text-ink-soft" : "text-white/85"}`}>
                  {s.name}
                </span>
                <span className={`tabular text-[11px] ${s.ink ? "text-muted" : "text-white/70"}`}>
                  {s.varName}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Buttons */}
        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Run Simulation</Button>
            <Button variant="secondary">Reset</Button>
            <Button variant="ghost">Skip primer</Button>
            <Button variant="danger">Delete node</Button>
            <Button variant="primary" size="sm">sm</Button>
            <Button variant="primary" size="lg">lg</Button>
          </div>
        </Section>

        {/* Badges */}
        <Section title="Badges — difficulty & health">
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">Stage 1</Badge>
            <Badge tone="neutral">Caching</Badge>
            <Badge tone="healthy" dot>Healthy</Badge>
            <Badge tone="load" dot>Under load</Badge>
            <Badge tone="bottleneck" dot>Bottleneck</Badge>
            <Badge tone="fail" dot>Failure</Badge>
          </div>
        </Section>

        {/* Cards + metrics */}
        <Section title="Cards & metrics">
          <div className="grid sm:grid-cols-2 gap-4">
            <Card interactive animate>
              <CardKicker>Level 1 · TinyURL</CardKicker>
              <CardTitle className="mt-1">Build a URL shortener</CardTitle>
              <p className="mt-2 text-sm text-ink-soft">
                100 req/min · win at p99 ≤ 200ms · avail ≥ 99% · cost ≤ $5/hr.
              </p>
              <div className="mt-4 flex gap-2">
                <Badge tone="brand">Stage 1</Badge>
                <Badge tone="neutral">APIs</Badge>
                <Badge tone="neutral">Databases</Badge>
              </div>
            </Card>

            <Card animate>
              <CardKicker>Simulation result</CardKicker>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <MetricStat label="p99" value={142} unit="ms" status="healthy" />
                <MetricStat label="avail" value="99.4" unit="%" status="healthy" />
                <MetricStat label="cost" value="$6" unit="/hr" status="bottleneck" />
              </div>
              <div className="mt-5 pt-4 border-t border-line flex items-center justify-between">
                <span className="text-sm text-muted">Final score</span>
                <span className="tabular text-3xl font-extrabold text-ink">87</span>
              </div>
            </Card>
          </div>
        </Section>
      </motion.main>
    </div>
  );
}
