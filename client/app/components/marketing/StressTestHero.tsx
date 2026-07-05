"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import posthog from "posthog-js";

/**
 * Interactive stress-test diagram — the landing's signature moment.
 * Flip the traffic scenario and watch the SAME architecture degrade:
 * node health shifts green→amber→red→black, packets pile up and drop,
 * metrics collapse, verdict flips. This is the product promise, demoed.
 * Designed values (not the real engine) — marketing surface only.
 */

type Status = "healthy" | "load" | "bottleneck" | "fail";
const STATUS_COLOR: Record<Status, string> = {
  healthy: "var(--healthy)",
  load: "var(--load)",
  bottleneck: "var(--bottleneck)",
  fail: "var(--fail)",
};

interface Scenario {
  id: string;
  label: string;
  rate: string;
  nodes: { util: number; status: Status }[]; // client, api, db
  packets: { count: number; duration: number; drop: number; color: string };
  metrics: { p99: string; avail: string; cost: string; score: number };
  verdict: "pass" | "risk" | "fail";
}

const SCENARIOS: Scenario[] = [
  {
    id: "normal", label: "Normal day", rate: "100 req/min",
    nodes: [{ util: 0.18, status: "healthy" }, { util: 0.34, status: "healthy" }, { util: 0.41, status: "healthy" }],
    packets: { count: 3, duration: 1.7, drop: 0, color: "var(--brand)" },
    metrics: { p99: "142ms", avail: "99.9%", cost: "$5/hr", score: 98 },
    verdict: "pass",
  },
  {
    id: "blackfriday", label: "Black Friday", rate: "9k req/min",
    nodes: [{ util: 0.42, status: "healthy" }, { util: 0.81, status: "load" }, { util: 0.94, status: "bottleneck" }],
    packets: { count: 5, duration: 1.0, drop: 0.15, color: "var(--load)" },
    metrics: { p99: "480ms", avail: "96.4%", cost: "$5/hr", score: 61 },
    verdict: "risk",
  },
  {
    id: "ddos", label: "DDoS", rate: "1.2M req/min",
    nodes: [{ util: 1, status: "bottleneck" }, { util: 1, status: "fail" }, { util: 0.7, status: "bottleneck" }],
    packets: { count: 7, duration: 0.55, drop: 0.55, color: "var(--bottleneck)" },
    metrics: { p99: "timeout", avail: "58%", cost: "$5/hr", score: 12 },
    verdict: "fail",
  },
];

const NODES = [
  { id: "client", label: "Client", x: 72 },
  { id: "api", label: "API", x: 240 },
  { id: "db", label: "Database", x: 408 },
];
const Y = 84;
const R = 27;

function Packet({ from, to, delay, duration, color, drop }: {
  from: number; to: number; delay: number; duration: number; color: string; drop: number;
}) {
  const dropped = Math.random() < drop;
  return (
    <motion.circle
      r={5} fill={color}
      initial={{ cx: from, cy: Y, opacity: 0 }}
      animate={
        dropped
          ? { cx: [from, from + (to - from) * 0.6], cy: [Y, Y + 22], opacity: [0, 1, 0] }
          : { cx: [from, to], cy: Y, opacity: [0, 1, 1, 0] }
      }
      transition={{ duration, delay, repeat: Infinity, repeatDelay: 0.3, ease: "easeInOut" }}
    />
  );
}

const VERDICT = {
  pass: { tone: "var(--healthy)", soft: "var(--healthy-soft)", text: "#1d7a4d", label: "PASSING" },
  risk: { tone: "var(--load)", soft: "var(--load-soft)", text: "#9a6512", label: "AT RISK" },
  fail: { tone: "var(--bottleneck)", soft: "var(--bottleneck-soft)", text: "#b3262b", label: "FAILED" },
} as const;

export function StressTestHero() {
  const [idx, setIdx] = React.useState(0);
  const s = SCENARIOS[idx];
  const v = VERDICT[s.verdict];

  return (
    <div className="rounded-[var(--radius-xl)] border border-line bg-surface p-5 shadow-lg">
      {/* HUD header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="label-spec">SIM · TINYURL-1</span>
        <motion.span
          key={s.verdict}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide"
          style={{ background: v.soft, color: v.text }}
        >
          <span className="size-1.5 rounded-full" style={{ background: v.tone }} />
          {v.label}
        </motion.span>
      </div>

      {/* scenario control */}
      <div className="mb-4 flex gap-1 rounded-[var(--radius-md)] bg-paper-sunken p-1">
        {SCENARIOS.map((sc, i) => (
          <button
            key={sc.id}
            onClick={() => { setIdx(i); posthog.capture("hero_scenario_changed", { scenario_id: sc.id, scenario_label: sc.label }); }}
            className="relative flex-1 rounded-[calc(var(--radius-md)-4px)] px-2 py-1.5 text-xs font-semibold transition-colors"
            style={{ color: i === idx ? "var(--ink)" : "var(--muted)" }}
          >
            {i === idx && (
              <motion.span
                layoutId="scenario-pill"
                className="absolute inset-0 rounded-[calc(var(--radius-md)-4px)] bg-surface shadow-sm"
                transition={{ type: "spring", stiffness: 480, damping: 34 }}
              />
            )}
            <span className="relative">{sc.label}</span>
          </button>
        ))}
      </div>

      {/* diagram */}
      <svg viewBox="0 0 480 150" className="w-full h-auto">
        {[[NODES[0], NODES[1]], [NODES[1], NODES[2]]].map(([a, b], i) => (
          <line key={i} x1={a.x + R} y1={Y} x2={b.x - R} y2={Y}
            stroke="var(--line-strong)" strokeWidth={2} strokeDasharray="2 6" strokeLinecap="round" />
        ))}

        {/* packets keyed by scenario so they remount on change */}
        <g key={s.id}>
          {[[NODES[0].x + R, NODES[1].x - R], [NODES[1].x + R, NODES[2].x - R]].map(([f, t], seg) =>
            Array.from({ length: s.packets.count }).map((_, k) => (
              <Packet key={`${seg}-${k}`} from={f} to={t}
                delay={(k / s.packets.count) * s.packets.duration + seg * 0.2}
                duration={s.packets.duration} color={s.packets.color} drop={s.packets.drop} />
            )),
          )}
        </g>

        {/* nodes */}
        {NODES.map((n, i) => {
          const ns = s.nodes[i];
          const col = STATUS_COLOR[ns.status];
          const stressed = ns.status === "bottleneck" || ns.status === "fail";
          return (
            <g key={n.id}>
              <motion.circle
                cx={n.x} cy={Y} r={R} fill="var(--surface)"
                animate={{
                  stroke: col,
                  x: stressed ? [0, -1.2, 1.2, 0] : 0,
                }}
                transition={{
                  stroke: { duration: 0.5 },
                  x: { duration: 0.25, repeat: stressed ? Infinity : 0 },
                }}
                strokeWidth={3}
              />
              <motion.circle cx={n.x} cy={Y - 10} r={3.5} animate={{ fill: col }} />
              <text x={n.x} y={Y + 5} textAnchor="middle" className="fill-ink" style={{ fontSize: 11, fontWeight: 600 }}>
                {n.label}
              </text>
              {/* utilization bar */}
              <rect x={n.x - 26} y={Y + R + 6} width={52} height={5} rx={2.5} fill="var(--paper-sunken)" />
              <motion.rect
                x={n.x - 26} y={Y + R + 6} height={5} rx={2.5}
                animate={{ width: 52 * ns.util, fill: col }}
                transition={{ type: "spring", stiffness: 200, damping: 26 }}
              />
              <text x={n.x} y={Y + R + 24} textAnchor="middle" className="tabular" style={{ fontSize: 9, fill: "var(--muted)" }}>
                {Math.round(ns.util * 100)}%
              </text>
            </g>
          );
        })}
      </svg>

      {/* metrics */}
      <div className="mt-3 grid grid-cols-4 gap-2 border-t border-line pt-4">
        {([
          ["traffic", s.rate, "var(--ink)"],
          ["p99", s.metrics.p99, s.verdict === "fail" ? "var(--bottleneck)" : s.verdict === "risk" ? "var(--load)" : "var(--ink)"],
          ["avail", s.metrics.avail, s.verdict === "fail" ? "var(--bottleneck)" : "var(--ink)"],
          ["score", String(s.metrics.score), v.tone],
        ] as const).map(([k, val, color]) => (
          <div key={k}>
            <div className="label-spec mb-0.5">{k}</div>
            <AnimatePresence mode="wait">
              <motion.div
                key={val}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className="tabular text-base font-bold leading-none"
                style={{ color }}
              >
                {val}
              </motion.div>
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
