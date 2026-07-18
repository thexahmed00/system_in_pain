"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, BackgroundVariant,
  useReactFlow,
  type NodeChange, type EdgeChange, type Connection, type NodeTypes, type EdgeTypes,
} from "@xyflow/react";
import { FlowEdge } from "@/app/components/canvas/FlowEdge";
import { Play, RotateCcw, Trash2, ArrowLeft, Lock, Zap, ChevronLeft, ChevronRight, Star, MessageCircle } from "lucide-react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Panel } from "@/app/components/ui/Panel";
import { Badge } from "@/app/components/ui/Badge";
import { InfoTip } from "@/app/components/ui/InfoTip";
import { GLOSSARY } from "@/app/lib/glossary";
import { ComponentNode } from "@/app/components/canvas/ComponentNode";
import { ResultModal } from "@/app/components/play/ResultModal";
import { LoginGateModal } from "@/app/components/play/LoginGateModal";
import { FeedbackPromptModal } from "@/app/components/play/FeedbackPromptModal";
import { MobileGuard } from "@/app/components/play/MobileGuard";
import { useIsMobile } from "@/app/lib/use-is-mobile";
import { shouldShowFeedbackPrompt, markFeedbackPromptShown } from "@/app/lib/feedback-prompt-storage";
import { CATALOG, GROUP_ORDER, LEVELS, UNLOCK_LEVEL } from "./level-data";
import { simulate } from "@sdq/sim-engine";
import { stagger, fadeRise, popIn, spring } from "@/app/lib/motion";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  nodesChanged, edgesChanged, connected, nodeAdded, nodeDeleted,
  selectedSet, healthPainted, edgeFlowPainted, healthCleared, graphReset, graphSeeded,
} from "@/app/store/architecture.slice";
import { runStarted, runFinished, simCleared } from "@/app/store/sim.slice";
import { levelPassed } from "@/app/store/progress.slice";
import { isLevelUnlocked, highestUnlockedIndex } from "@/app/lib/level-lock";
import { DIM_LABELS, dimColor } from "@/app/lib/sim-display";
import posthog from "posthog-js";

const nodeTypes: NodeTypes = { component: ComponentNode };
const edgeTypes: EdgeTypes = { flow: FlowEdge };

function PlayInner() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rawLevelIdx, setLevelIdx] = React.useState(() => {
    const requested = searchParams.get("level");
    const idx = requested ? LEVELS.findIndex((l) => l.id === requested) : -1;
    return idx !== -1 ? idx : 0;
  });
  const [showResult, setShowResult] = React.useState(false);
  const [showLoginGate, setShowLoginGate] = React.useState(false);
  const [showFeedbackPrompt, setShowFeedbackPrompt] = React.useState(false);
  const nodes = useAppSelector((s) => s.architecture.nodes);
  const edges = useAppSelector((s) => s.architecture.edges);
  const selected = useAppSelector((s) => s.architecture.selected);
  const result = useAppSelector((s) => s.sim.result);
  const running = useAppSelector((s) => s.sim.running);
  const progressHydrated = useAppSelector((s) => s.progress.hydrated);
  const byLevelId = useAppSelector((s) => s.progress.byLevelId);
  const { screenToFlowPosition } = useReactFlow();
  const { user } = useUser();
  const loggedIn = !!user;

  // a deep link (or stale URL) can point at a level not yet unlocked — once progress
  // has loaded from localStorage, render the highest reachable level instead. Derived
  // at render time (not via an effect) so there's no extra state to keep in sync.
  const levelIdx = progressHydrated && !isLevelUnlocked(rawLevelIdx, byLevelId, loggedIn)
    ? highestUnlockedIndex(byLevelId, loggedIn)
    : rawLevelIdx;
  const level = LEVELS[levelIdx];

  // show the result dialog after every graded run — pass or fail
  React.useEffect(() => {
    if (result?.ok) setShowResult(true);
  }, [result]);

  // any structural edit invalidates the last run
  const invalidate = React.useCallback(() => {
    dispatch(simCleared());
    dispatch(healthCleared());
    setShowResult(false);
  }, [dispatch]);

  const onNodesChange = React.useCallback((c: NodeChange[]) => dispatch(nodesChanged(c)), [dispatch]);
  const onEdgesChange = React.useCallback((c: EdgeChange[]) => {
    dispatch(edgesChanged(c));
    if (c.some((ch) => ch.type === "remove")) invalidate(); // deleting a connection invalidates the run
  }, [dispatch, invalidate]);
  const onConnect = React.useCallback((c: Connection) => { dispatch(connected(c)); invalidate(); }, [dispatch, invalidate]);

  const onDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/sdq");
    if (!type) return;
    dispatch(nodeAdded({ type, position: screenToFlowPosition({ x: e.clientX, y: e.clientY }) }));
    posthog.capture("component_added", {
      component_type: type,
      level_id: level.id,
      level_title: level.title,
      level_index: levelIdx,
    });
    invalidate();
  }, [dispatch, screenToFlowPosition, invalidate, level, levelIdx]);

  const deleteSelected = React.useCallback(() => {
    if (!selected) return;
    dispatch(nodeDeleted(selected));
    posthog.capture("node_deleted", {
      level_id: level.id,
      level_title: level.title,
      level_index: levelIdx,
    });
    invalidate();
  }, [dispatch, selected, invalidate, level, levelIdx]);

  const run = React.useCallback(() => {
    posthog.capture("simulation_run", {
      level_id: level.id,
      level_title: level.title,
      level_index: levelIdx,
      node_count: nodes.length,
      edge_count: edges.length,
    });
    dispatch(runStarted());
    const graph = {
      nodes: nodes.map((n) => {
        const d = n.data as { compType: string; instances?: number };
        return { id: n.id, type: d.compType, config: d.instances ? { instances: d.instances } : undefined };
      }),
      edges: edges.map((e) => ({ source: e.source, target: e.target })),
    };
    const res = simulate(graph, level);
    dispatch(healthPainted(res.nodes));
    dispatch(edgeFlowPainted(res.edgeFlows));
    posthog.capture("simulation_completed", {
      level_id: level.id,
      level_title: level.title,
      level_index: levelIdx,
      passed: res.passed,
      score: res.final,
      p99_ms: res.ok ? res.metrics.p99 : null,
      availability: res.ok ? res.metrics.availability : null,
      cost_per_hour: res.ok ? res.metrics.costPerHour : null,
      stars_earned: res.ok ? res.stars.filter((s) => s.earned).length : 0,
      stars_total: res.ok ? res.stars.length : 0,
    });
    if (res.ok && res.passed) {
      posthog.capture("level_completed", {
        level_id: level.id,
        level_title: level.title,
        level_index: levelIdx,
        score: res.final,
        stars_earned: res.stars.filter((s) => s.earned).length,
        stars_total: res.stars.length,
      });
      const starsEarned = res.stars.filter((s) => s.earned).length;
      dispatch(levelPassed({
        levelId: level.id,
        score: res.final,
        starsEarned,
        starsTotal: res.stars.length,
      }));
      // Persist to the account, not just this browser — the login gate promises
      // progress follows the user (LoginGateModal); localStorage alone can't keep
      // that promise across devices or a cleared browser.
      if (loggedIn) {
        fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ levelId: level.id, score: res.final, starsEarned, starsTotal: res.stars.length }),
        }).catch(() => {});
      }
      // First nudge after Level 3 (early enough to catch someone before they'd
      // drop off), then recurring every few levels for anyone still playing —
      // an engaged player keeps getting asked, someone who bounces doesn't.
      if (shouldShowFeedbackPrompt(levelIdx)) {
        markFeedbackPromptShown(levelIdx);
        setShowFeedbackPrompt(true);
      }
    }
    setTimeout(() => dispatch(runFinished(res)), 520);
  }, [dispatch, nodes, edges, level, levelIdx, loggedIn]);

  // levels with a starterGraph open pre-built (L5 starts over-engineered); reset restores it
  const seedCanvas = React.useCallback((lvl: typeof level) => {
    dispatch(lvl.starterGraph ? graphSeeded(lvl.starterGraph) : graphReset());
  }, [dispatch]);

  const reset = React.useCallback(() => {
    posthog.capture("canvas_reset", {
      level_id: level.id,
      level_title: level.title,
      level_index: levelIdx,
    });
    seedCanvas(level); dispatch(simCleared()); setShowResult(false);
  }, [dispatch, seedCanvas, level, levelIdx]);
  const goLevel = React.useCallback((i: number) => {
    if (i < 0 || i >= LEVELS.length) return;
    if (!isLevelUnlocked(i, byLevelId, loggedIn)) return;
    posthog.capture("level_changed", {
      from_level_index: levelIdx,
      to_level_index: i,
      to_level_id: LEVELS[i].id,
      to_level_title: LEVELS[i].title,
      direction: i > levelIdx ? "next" : "prev",
    });
    setLevelIdx(i);
    setShowResult(false);
    seedCanvas(LEVELS[i]);
    dispatch(simCleared());
    router.replace(`/play?level=${LEVELS[i].id}`, { scroll: false });
  }, [dispatch, seedCanvas, levelIdx, byLevelId, loggedIn, router]);

  // steady (tier-1) gates this level sets — render only what it tests
  const w = level.winConditions.steady;
  const gates: [string, string, string][] = [];
  if (w.p95LatencyMs != null) gates.push(["p95 latency", `≤ ${w.p95LatencyMs}ms`, GLOSSARY.p95Latency]);
  if (w.p99LatencyMs != null) gates.push(["p99 latency", `≤ ${w.p99LatencyMs}ms`, GLOSSARY.p99Latency]);
  if (w.availability != null) gates.push(["availability", `≥ ${(w.availability * 100).toFixed(0)}%`, GLOSSARY.availability]);
  if (w.minThroughputRps != null) gates.push(["throughput", `≥ ${w.minThroughputRps} r/s`, GLOSSARY.throughput]);
  if (w.maxErrorRate != null) gates.push(["error rate", `≤ ${(w.maxErrorRate * 100).toFixed(0)}%`, GLOSSARY.errorRate]);
  if (w.maxCostPerHour != null) gates.push(["cost", `≤ $${w.maxCostPerHour}/hr`, GLOSSARY.cost]);

  // tier-2 scenario gates (visible rows; pass/fail filled in after a run)
  const scenarios = level.winConditions.scenarios ?? [];
  const scenResult = (name: string) => result?.scenarios?.find((s) => s.name === name);
  const prettyName = (t: string) => t.replace(/-/g, " ");

  return (
    <div className="flex h-screen flex-col bg-paper">
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
        <div className="flex items-center gap-3">
          <Link href="/levels" className="text-muted transition-colors hover:text-ink"><ArrowLeft size={18} /></Link>
          <span className="grid size-6 place-items-center rounded-md bg-brand text-white"><Zap size={13} fill="currentColor" /></span>
          <div className="flex items-center gap-1">
            <button onClick={() => goLevel(levelIdx - 1)} disabled={levelIdx === 0} aria-label="Previous level" className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-paper-sunken hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"><ChevronLeft size={16} /></button>
            <span className="font-display font-bold text-ink">Level {levelIdx + 1} · {level.title}</span>
            <button onClick={() => goLevel(levelIdx + 1)} disabled={levelIdx === LEVELS.length - 1 || !isLevelUnlocked(levelIdx + 1, byLevelId, loggedIn)} aria-label="Next level" className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-paper-sunken hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"><ChevronRight size={16} /></button>
          </div>
          <Badge tone="neutral" className="!text-[10px]">{level.concepts[0]?.toUpperCase()}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { markFeedbackPromptShown(levelIdx); setShowFeedbackPrompt(true); }}
            aria-label="Send feedback"
            title="Send feedback"
            className="grid size-9 place-items-center rounded-[var(--radius-md)] border border-line-strong bg-surface text-ink-soft shadow-pop transition-all hover:bg-paper-sunken active:translate-y-[2px] active:shadow-none"
          >
            <MessageCircle size={16} />
          </button>
          <button onClick={reset} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-line-strong bg-surface px-3 text-sm font-semibold text-ink-soft shadow-pop transition-all hover:bg-paper-sunken active:translate-y-[2px] active:shadow-none">
            <RotateCcw size={14} /> Reset
          </button>
          <button onClick={run} disabled={running} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] bg-brand px-4 text-sm font-bold text-white shadow-pop-brand transition-all hover:bg-brand-press active:translate-y-[2px] active:shadow-none disabled:opacity-60">
            <Play size={14} fill="currentColor" /> {running ? "Running…" : "Run simulation"}
          </button>
        </div>
      </header>

      {/* 3-pane */}
      <div className="grid min-h-0 flex-1 grid-cols-[330px_1fr_280px] gap-3 p-3">
        {/* LEFT — question + result */}
        <Panel kicker={`Stage ${level.stage} · ${level.concepts.join(" · ")}`} title={level.title}>
          <p className="text-sm leading-relaxed text-ink-soft">{level.story}</p>

          {level.requirements && (
            <div className="mt-5 space-y-3">
              <p className="label-spec">Requirements</p>
              {(
                [
                  ["Functional", level.requirements.functional, "text-ink-soft"],
                  ["Non-functional", level.requirements.nonFunctional, "text-ink-soft"],
                  ["Constraints", level.requirements.constraints, "text-ink-soft"],
                  ["Out of scope", level.requirements.outOfScope, "text-muted"],
                ] as [string, string[] | undefined, string][]
              )
                .filter(([, items]) => items && items.length > 0)
                .map(([heading, items, tone]) => (
                  <div key={heading}>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{heading}</p>
                    <ul className="space-y-1">
                      {items!.map((item) => (
                        <li key={item} className={`flex gap-1.5 text-sm leading-snug ${tone}`}>
                          <span className="text-muted">·</span>{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}

          <div className="mt-5 space-y-2">
            <p className="label-spec flex items-center gap-1">Traffic<InfoTip text={GLOSSARY.rps} /></p>
            <div className="rounded-[var(--radius-md)] bg-paper-sunken px-3 py-2">
              {(() => {
                const rps = Math.round(level.traffic.ratePerMin / 60);
                const reads = Math.round(level.traffic.readWriteRatio * 100);
                const writes = 100 - reads;
                const bots = Math.round((level.traffic.maliciousRatio ?? 0) * 100);
                const shape = reads >= 70 ? "read-heavy" : writes >= 70 ? "write-heavy" : "mixed";
                return (
                  <>
                    <div className="text-sm font-semibold text-ink">~{rps} r/s · {shape}</div>
                    <div className="tabular mt-0.5 flex items-center gap-1 text-xs text-muted">
                      {reads}% reads · {writes}% writes
                      <InfoTip text={GLOSSARY.readWrite} />
                      {bots > 0 && (
                        <span className="flex items-center gap-1 font-semibold text-[#b91c1c]">
                          · {bots}% bot traffic<InfoTip text={GLOSSARY.botTraffic} />
                        </span>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <p className="label-spec">Win conditions</p>
            <ul className="space-y-1.5 text-sm">
              {gates.map(([k, v, tip]) => (
                <li key={k} className="flex justify-between">
                  <span className="flex items-center gap-1 text-muted">{k}<InfoTip text={tip} /></span>
                  <span className="tabular font-semibold text-ink">{v}</span>
                </li>
              ))}
            </ul>

            {(level.failureInjections?.length ?? 0) > 0 && (
              <div className="mt-4 space-y-2">
                <p className="label-spec">During the run</p>
                <ul className="space-y-1.5 text-sm">
                  {level.failureInjections!.map((f, i) => (
                    <li key={i} className="flex justify-between">
                      <span className="text-muted">
                        {f.kind === "spike" ? `${f.multiplier}× traffic burst` : f.kind === "node-down" ? `${f.nodeType.replace(/-/g, " ")} outage` : `+${f.addMs}ms network lag`}
                      </span>
                      <span className="tabular font-semibold text-ink">at {f.atSecond}s · {f.durationSec}s</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {scenarios.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="label-spec">Scenarios</p>
                <ul className="space-y-1.5 text-sm">
                  {scenarios.map((s) => {
                    const r = scenResult(s.name);
                    const target = s.mustMeet.availability != null ? `≥ ${(s.mustMeet.availability * 100).toFixed(0)}% up` : "survive";
                    return (
                      <li key={s.name} className="flex items-center justify-between">
                        <span className="text-muted">{prettyName(s.name)}{s.trafficMultiplier ? ` ${s.trafficMultiplier}×` : ""}</span>
                        <span className="flex items-center gap-1.5">
                          <span className="tabular font-semibold text-ink">{target}</span>
                          {r && <span className="size-2 shrink-0 rounded-full" style={{ background: r.passed ? "var(--healthy)" : "var(--bottleneck)" }} />}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <AnimatePresence>
            {result && (
              <motion.div
                variants={stagger(0.05)} initial="hidden" animate="show"
                className="mt-6 border-t border-line pt-5"
              >
                {!result.ok ? (
                  <motion.p variants={fadeRise} className="rounded-[var(--radius-md)] bg-load-soft px-3 py-2.5 text-sm text-[#9a6512]">
                    {result.error}
                  </motion.p>
                ) : (
                  <>
                    <motion.div variants={popIn} className="mb-4 flex items-center justify-between rounded-[var(--radius-lg)] border border-line p-4">
                      <div>
                        <p className="label-spec">Final score</p>
                        <p className="tabular text-4xl font-extrabold leading-none" style={{ color: dimColor(result.final) }}>{result.final}</p>
                      </div>
                      <Badge tone={result.passed ? "healthy" : "bottleneck"} dot>{result.passed ? "COMPLETE" : "NOT PASSED"}</Badge>
                    </motion.div>

                    <motion.div variants={fadeRise} className="mb-4 grid grid-cols-2 gap-2">
                      {[
                        ["p99", `${result.metrics.p99}ms`, GLOSSARY.p99Latency],
                        ["avail", `${(result.metrics.availability * 100).toFixed(1)}%`, GLOSSARY.availability],
                        ["cost", `$${result.metrics.costPerHour}/hr`, GLOSSARY.cost],
                        ["tps", `${Math.round(result.metrics.throughput)}r/s`, GLOSSARY.throughput],
                      ].map(([k, v, tip]) => (
                        <div key={k} className="rounded-[var(--radius-md)] bg-paper-sunken px-2 py-1.5">
                          <div className="label-spec flex items-center gap-1">{k}<InfoTip text={tip} /></div>
                          <div className="tabular text-sm font-bold text-ink">{v}</div>
                        </div>
                      ))}
                    </motion.div>

                    <motion.div variants={fadeRise} className="space-y-2">
                      {DIM_LABELS.map(([k, label]) => {
                        const active = result.activeDimensions.includes(k);
                        return (
                          <div key={k} className={active ? "" : "opacity-40"}>
                            <div className="mb-1 flex justify-between text-xs">
                              <span className="flex items-center gap-1 text-ink-soft">
                                {label}<InfoTip text={GLOSSARY[k]} />
                                {!active && <span className="ml-1 text-[10px] text-muted">not tested</span>}
                              </span>
                              <span className="tabular font-semibold text-ink">{active ? result.dims[k] : "—"}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-paper-sunken">
                              {active && <motion.div initial={{ width: 0 }} animate={{ width: `${result.dims[k]}%` }} transition={spring.soft} className="h-full rounded-full" style={{ background: dimColor(result.dims[k]) }} />}
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>

                    {result.stars.length > 0 && (
                      <motion.div variants={fadeRise} className="mt-4 flex items-center gap-1.5">
                        {result.stars.map((s) => (
                          <span key={s.id} title={`${s.label}: ${s.hint}`}>
                            <Star size={16} strokeWidth={2} style={{ color: s.earned ? "#e0a106" : "var(--line-strong)", fill: s.earned ? "#e0a106" : "transparent" }} />
                          </span>
                        ))}
                        <span className="ml-1 text-xs font-semibold text-muted">{result.stars.filter((s) => s.earned).length}/{result.stars.length} stars</span>
                      </motion.div>
                    )}

                    {result.lesson && (
                      <motion.p variants={fadeRise} className="mt-4 rounded-r-[var(--radius-md)] border-l-[3px] border-load bg-load-soft/60 px-3 py-2.5 text-sm text-ink-soft">
                        {result.lesson}
                      </motion.p>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Panel>

        {/* CENTER — canvas */}
        <div className="relative min-h-0 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface shadow-sm">
          <ReactFlow
            nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onNodeClick={(_, n) => dispatch(selectedSet(n.id))}
            onPaneClick={() => dispatch(selectedSet(null))}
            onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
            fitView proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ type: "flow" }}
            connectionLineStyle={{ stroke: "var(--brand)", strokeWidth: 2, strokeLinecap: "round", strokeDasharray: "4 4" }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="var(--line-strong)" />
            <Controls showInteractive={false} className="!rounded-[var(--radius-md)] !border !border-line !shadow-md" />
          </ReactFlow>

          {/* flow legend — appears once a run has painted the edges */}
          {result?.ok && (
            <div className="absolute left-4 top-4 flex items-center gap-3 rounded-full border border-line bg-surface/90 px-3 py-1.5 text-[11px] font-semibold text-ink-soft shadow-sm backdrop-blur">
              {([["reads", "#2563eb"], ["writes", "#d97706"], ["both", "#7c3aed"]] as const).map(([label, color]) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* selection toolbar */}
          <AnimatePresence>
            {selected && (
              <motion.button
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                onClick={deleteSelected}
                className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-bottleneck px-4 py-2 text-sm font-semibold text-white shadow-lg"
              >
                <Trash2 size={14} /> Delete node
              </motion.button>
            )}
          </AnimatePresence>

          {nodes.length <= 1 && (
            <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-muted">
              Drag components from the right → connect their handles → Run.
            </p>
          )}
        </div>

        {/* RIGHT — palette */}
        <Panel kicker="Drag onto canvas" title="Components" bodyClassName="!p-3">
          <div className="space-y-5">
            {GROUP_ORDER.map((group) => {
              const items = Object.values(CATALOG).filter((c) => c.group === group);
              if (!items.length) return null;
              return (
                <div key={group}>
                  <p className="label-spec mb-2 px-1">{group}</p>
                  <div className="space-y-1.5">
                    {items.map((c) => {
                      // Progressive palette: a tool unlocks at the first level that
                      // teaches it, then stays draggable in every later level
                      // (distractors appear only after their lesson). A tool no level
                      // teaches yet (unlockAt === LEVELS.length) reads "Coming soon"
                      // instead of a fake level number past the curriculum's end.
                      const unlockAt = UNLOCK_LEVEL[c.type] ?? 0;
                      const unlocked = levelIdx >= unlockAt && unlockAt < LEVELS.length;
                      const comingSoon = unlockAt >= LEVELS.length;
                      const Icon = c.icon;
                      return (
                        <div
                          key={c.type}
                          draggable={unlocked}
                          onDragStart={(e) => e.dataTransfer.setData("application/sdq", c.type)}
                          title={unlocked ? c.blurb : comingSoon ? `Coming soon — ${c.blurb}` : `Unlocks at Level ${unlockAt + 1} — ${c.blurb}`}
                          className={
                            "flex items-center gap-2.5 rounded-[var(--radius-md)] border px-2.5 py-2 text-sm transition-all " +
                            (unlocked
                              ? "cursor-grab border-line bg-surface text-ink shadow-pop hover:border-brand/40 hover:bg-brand-soft/40 active:cursor-grabbing"
                              : "cursor-not-allowed border-dashed border-line bg-paper-sunken/50 text-muted")
                          }
                        >
                          <span className="grid size-7 shrink-0 place-items-center rounded-md" style={{ background: unlocked ? "var(--brand-soft)" : "transparent", color: unlocked ? "var(--brand)" : "var(--muted)" }}>
                            {unlocked ? <Icon size={15} /> : <Lock size={13} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="inline-flex items-center gap-1 font-semibold">
                              {c.label}
                              {unlocked && <InfoTip text={c.blurb} />}
                            </span>
                            {c.kind !== "source" && (
                              <div className="tabular text-[10px] leading-tight text-muted">
                                {c.cap === Infinity ? "∞" : c.cap} r/s · {c.baseMs}ms · ${c.cost}/hr
                              </div>
                            )}
                          </div>
                          {!unlocked && (
                            <span className="shrink-0 text-[10px] font-semibold text-muted">
                              {comingSoon ? "Soon" : `Lvl ${unlockAt + 1}`}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <AnimatePresence>
        {showResult && result?.ok && (
          <ResultModal
            result={result}
            level={level}
            levelNumber={levelIdx + 1}
            isLast={levelIdx === LEVELS.length - 1}
            onNext={() => {
              if (!isLevelUnlocked(levelIdx + 1, byLevelId, loggedIn)) {
                setShowResult(false);
                setShowLoginGate(true);
                return;
              }
              goLevel(levelIdx + 1);
            }}
            onReplay={() => setShowResult(false)}
            onClose={() => setShowResult(false)}
          />
        )}
        {showLoginGate && (
          <LoginGateModal returnTo={`/play?level=${LEVELS[levelIdx + 1]?.id ?? LEVELS[levelIdx].id}`} />
        )}
        {showFeedbackPrompt && (
          <FeedbackPromptModal onDismiss={() => setShowFeedbackPrompt(false)} levelNumber={levelIdx + 1} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PlayPage() {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileGuard />;

  return (
    <React.Suspense fallback={null}>
      <ReactFlowProvider>
        <PlayInner />
      </ReactFlowProvider>
    </React.Suspense>
  );
}
