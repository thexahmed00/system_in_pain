"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, BackgroundVariant,
  useReactFlow,
  type NodeChange, type EdgeChange, type Connection, type NodeTypes,
} from "@xyflow/react";
import { Play, RotateCcw, Trash2, ArrowLeft, Lock, Zap } from "lucide-react";
import { Panel } from "@/app/components/ui/Panel";
import { Badge } from "@/app/components/ui/Badge";
import { ComponentNode } from "@/app/components/canvas/ComponentNode";
import { CATALOG, GROUP_ORDER, TINYURL } from "./level-data";
import { simulate, type SimResult } from "./preview-sim";
import { stagger, fadeRise, popIn, spring } from "@/app/lib/motion";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  nodesChanged, edgesChanged, connected, nodeAdded, nodeDeleted,
  selectedSet, healthPainted, healthCleared, graphReset,
} from "@/app/store/architecture.slice";
import { runStarted, runFinished, simCleared } from "@/app/store/sim.slice";

const nodeTypes: NodeTypes = { component: ComponentNode };

const DIM_LABELS: [keyof SimResult["dims"], string][] = [
  ["performance", "Performance"], ["reliability", "Reliability"],
  ["scalability", "Scalability"], ["cost", "Cost"], ["security", "Security"],
];

function dimColor(v: number) {
  return v >= 80 ? "var(--healthy)" : v >= 50 ? "var(--load)" : "var(--bottleneck)";
}

function PlayInner() {
  const level = TINYURL;
  const dispatch = useAppDispatch();
  const nodes = useAppSelector((s) => s.architecture.nodes);
  const edges = useAppSelector((s) => s.architecture.edges);
  const selected = useAppSelector((s) => s.architecture.selected);
  const result = useAppSelector((s) => s.sim.result);
  const running = useAppSelector((s) => s.sim.running);
  const { screenToFlowPosition } = useReactFlow();

  // any structural edit invalidates the last run
  const invalidate = React.useCallback(() => {
    dispatch(simCleared());
    dispatch(healthCleared());
  }, [dispatch]);

  const onNodesChange = React.useCallback((c: NodeChange[]) => dispatch(nodesChanged(c)), [dispatch]);
  const onEdgesChange = React.useCallback((c: EdgeChange[]) => dispatch(edgesChanged(c)), [dispatch]);
  const onConnect = React.useCallback((c: Connection) => { dispatch(connected(c)); invalidate(); }, [dispatch, invalidate]);

  const onDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/sdq");
    if (!type) return;
    dispatch(nodeAdded({ type, position: screenToFlowPosition({ x: e.clientX, y: e.clientY }) }));
    invalidate();
  }, [dispatch, screenToFlowPosition, invalidate]);

  const deleteSelected = React.useCallback(() => {
    if (!selected) return;
    dispatch(nodeDeleted(selected));
    invalidate();
  }, [dispatch, selected, invalidate]);

  const run = React.useCallback(() => {
    dispatch(runStarted());
    const graph = {
      nodes: nodes.map((n) => ({ id: n.id, type: (n.data as { compType: string }).compType })),
      edges: edges.map((e) => ({ source: e.source, target: e.target })),
    };
    const res = simulate(graph, level);
    dispatch(healthPainted(res.nodes));
    setTimeout(() => dispatch(runFinished(res)), 520);
  }, [dispatch, nodes, edges, level]);

  const reset = React.useCallback(() => { dispatch(graphReset()); dispatch(simCleared()); }, [dispatch]);
  const w = level.winConditions;

  return (
    <div className="flex h-screen flex-col bg-paper">
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted transition-colors hover:text-ink"><ArrowLeft size={18} /></Link>
          <span className="grid size-6 place-items-center rounded-md bg-brand text-white"><Zap size={13} fill="currentColor" /></span>
          <span className="font-display font-bold text-ink">Level {level.stage} · {level.title}</span>
          <Badge tone="neutral" className="!text-[10px]">PREVIEW ENGINE</Badge>
        </div>
        <div className="flex items-center gap-2">
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

          <div className="mt-5 space-y-2">
            <p className="label-spec">Traffic</p>
            <div className="rounded-[var(--radius-md)] bg-paper-sunken px-3 py-2 text-sm font-semibold text-ink">
              {level.traffic.ratePerMin} req/min · {Math.round(level.traffic.readWriteRatio * 100)}% reads
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <p className="label-spec">Win conditions</p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between"><span className="text-muted">p99 latency</span><span className="tabular font-semibold text-ink">≤ {w.p99LatencyMs}ms</span></li>
              <li className="flex justify-between"><span className="text-muted">availability</span><span className="tabular font-semibold text-ink">≥ {(w.availability * 100).toFixed(0)}%</span></li>
              <li className="flex justify-between"><span className="text-muted">cost</span><span className="tabular font-semibold text-ink">≤ ${w.maxCostPerHour}/hr</span></li>
            </ul>
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

                    <motion.div variants={fadeRise} className="mb-4 grid grid-cols-3 gap-2">
                      {[["p99", `${result.metrics.p99}ms`], ["avail", `${(result.metrics.availability * 100).toFixed(1)}%`], ["cost", `$${result.metrics.costPerHour}`]].map(([k, v]) => (
                        <div key={k} className="rounded-[var(--radius-md)] bg-paper-sunken px-2 py-1.5">
                          <div className="label-spec">{k}</div>
                          <div className="tabular text-sm font-bold text-ink">{v}</div>
                        </div>
                      ))}
                    </motion.div>

                    <motion.div variants={fadeRise} className="space-y-2">
                      {DIM_LABELS.map(([k, label]) => (
                        <div key={k}>
                          <div className="mb-1 flex justify-between text-xs"><span className="text-ink-soft">{label}</span><span className="tabular font-semibold text-ink">{result.dims[k]}</span></div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-paper-sunken">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${result.dims[k]}%` }} transition={spring.soft} className="h-full rounded-full" style={{ background: dimColor(result.dims[k]) }} />
                          </div>
                        </div>
                      ))}
                    </motion.div>

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
            nodes={nodes} edges={edges} nodeTypes={nodeTypes}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onNodeClick={(_, n) => dispatch(selectedSet(n.id))}
            onPaneClick={() => dispatch(selectedSet(null))}
            onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
            fitView proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ style: { stroke: "var(--line-strong)", strokeWidth: 2 } }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="var(--line-strong)" />
            <Controls showInteractive={false} className="!rounded-[var(--radius-md)] !border !border-line !shadow-md" />
          </ReactFlow>

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
                      const allowed = level.allowedComponents.includes(c.type);
                      const Icon = c.icon;
                      return (
                        <div
                          key={c.type}
                          draggable={allowed}
                          onDragStart={(e) => e.dataTransfer.setData("application/sdq", c.type)}
                          className={
                            "flex items-center gap-2.5 rounded-[var(--radius-md)] border px-2.5 py-2 text-sm transition-all " +
                            (allowed
                              ? "cursor-grab border-line bg-surface text-ink shadow-pop hover:border-brand/40 hover:bg-brand-soft/40 active:cursor-grabbing"
                              : "cursor-not-allowed border-dashed border-line bg-paper-sunken/50 text-muted")
                          }
                        >
                          <span className="grid size-7 place-items-center rounded-md" style={{ background: allowed ? "var(--brand-soft)" : "transparent", color: allowed ? "var(--brand)" : "var(--muted)" }}>
                            {allowed ? <Icon size={15} /> : <Lock size={13} />}
                          </span>
                          <span className="font-semibold">{c.label}</span>
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
    </div>
  );
}

export default function PlayPage() {
  return (
    <ReactFlowProvider>
      <PlayInner />
    </ReactFlowProvider>
  );
}
