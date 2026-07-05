"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Minus, Plus } from "lucide-react";
import { CATALOG } from "@/app/play/level-data";
import type { Status } from "@sdq/sim-engine";
import { useAppDispatch } from "@/app/store/hooks";
import { instancesSet, healthCleared } from "@/app/store/architecture.slice";
import { simCleared } from "@/app/store/sim.slice";

const RING: Record<Status, string> = {
  healthy: "var(--healthy)",
  load: "var(--load)",
  bottleneck: "var(--bottleneck)",
  fail: "var(--fail)",
};

/** Architecture node, themed to the design system. Health ring + util appear after a run.
    Stateless compute carries a replica stepper (×N → engine config.instances). */
export function ComponentNode({ id, data, selected }: NodeProps) {
  const d = data as { compType: string; instances?: number; status?: Status; util?: number };
  const dispatch = useAppDispatch();
  const spec = CATALOG[d.compType];
  if (!spec) return null;

  const Icon = spec.icon;
  const ring = d.status ? RING[d.status] : selected ? "var(--brand)" : "var(--line-strong)";
  const isSource = spec.kind === "source";
  // compute = stateless replicas; storage = scale the data tier (shards / partitions).
  // network / messaging / security nodes are not replicated — a single LB, CDN, or Queue
  // covers the full ingress; scaling those tiers happens by adding nodes behind an LB.
  const replicable = spec.kind === "compute" || spec.kind === "storage";
  // vertical scale ceiling — enforced so the player must use a Load Balancer to go further
  const maxInst = spec.maxInstances ?? 20;
  const instances = Math.max(1, d.instances ?? 1);
  const effCap = spec.cap === Infinity ? Infinity : spec.cap * instances;
  const effCost = spec.cost * instances;

  const setInstances = (next: number) => {
    const clamped = Math.max(1, Math.min(maxInst, next));
    if (clamped === instances) return;
    dispatch(instancesSet({ id, instances: clamped }));
    // a scaling change invalidates the last run
    dispatch(simCleared());
    dispatch(healthCleared());
  };

  return (
    <div
      className="group flex w-[132px] flex-col items-center gap-1 rounded-[var(--radius-lg)] border-2 bg-surface px-3 py-2.5 shadow-md transition-transform"
      style={{ borderColor: ring }}
    >
      {!isSource && <Handle id="t" type="target" position={Position.Top} className="!size-2 !border-2 !border-surface !bg-line-strong" />}
      {!isSource && <Handle id="l" type="target" position={Position.Left} className="!size-2 !border-2 !border-surface !bg-line-strong" />}

      <span
        className="grid size-9 place-items-center rounded-[var(--radius-md)]"
        style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
      >
        <Icon size={18} />
      </span>
      <span className="text-[13px] font-semibold leading-tight text-ink">
        {spec.label}
        {replicable && instances > 1 && <span className="ml-1 text-brand">×{instances}</span>}
      </span>
      {!isSource && (
        <span className="tabular text-[9px] text-muted">
          {effCap === Infinity ? "∞" : effCap}r/s · {spec.baseMs}ms · ${effCost}/hr
        </span>
      )}

      {/* replica stepper — stateless compute scales horizontally (nodrag/nopan so it doesn't move the node) */}
      {replicable && (
        <div className="nodrag nopan mt-0.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setInstances(instances - 1); }}
            disabled={instances <= 1}
            aria-label="Remove replica"
            className="grid size-5 place-items-center rounded-md border border-line-strong bg-surface text-ink-soft shadow-pop transition-all hover:bg-paper-sunken active:translate-y-[1px] active:shadow-none disabled:opacity-40"
          >
            <Minus size={11} />
          </button>
          <span className="tabular w-6 text-center text-[11px] font-bold text-ink">×{instances}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setInstances(instances + 1); }}
            disabled={instances >= maxInst}
            aria-label={instances >= maxInst ? `Maximum ${maxInst} instances — add a Load Balancer to scale further` : "Add replica"}
            className="grid size-5 place-items-center rounded-md border border-line-strong bg-surface text-ink-soft shadow-pop transition-all hover:bg-paper-sunken active:translate-y-[1px] active:shadow-none disabled:opacity-40"
          >
            <Plus size={11} />
          </button>
        </div>
      )}

      {/* utilization, shown after a run */}
      {d.util !== undefined && (
        <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-paper-sunken">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, d.util * 100)}%`, background: ring }} />
        </div>
      )}

      <Handle id="b" type="source" position={Position.Bottom} className="!size-2 !border-2 !border-surface !bg-line-strong" />
      <Handle id="r" type="source" position={Position.Right} className="!size-2 !border-2 !border-surface !bg-line-strong" />
    </div>
  );
}
