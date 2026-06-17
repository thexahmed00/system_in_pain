"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CATALOG } from "@/app/play/level-data";
import type { Status } from "@/app/play/preview-sim";

const RING: Record<Status, string> = {
  healthy: "var(--healthy)",
  load: "var(--load)",
  bottleneck: "var(--bottleneck)",
  fail: "var(--fail)",
};

/** Architecture node, themed to the design system. Health ring + util appear after a run. */
export function ComponentNode({ data, selected }: NodeProps) {
  const d = data as { compType: string; status?: Status; util?: number };
  const spec = CATALOG[d.compType];
  if (!spec) return null;
  const Icon = spec.icon;
  const ring = d.status ? RING[d.status] : selected ? "var(--brand)" : "var(--line-strong)";
  const isSource = spec.kind === "source";

  return (
    <div
      className="group flex w-[132px] flex-col items-center gap-1 rounded-[var(--radius-lg)] border-2 bg-surface px-3 py-2.5 shadow-md transition-transform"
      style={{ borderColor: ring }}
    >
      {!isSource && <Handle type="target" position={Position.Top} className="!size-2 !border-2 !border-surface !bg-line-strong" />}

      <span
        className="grid size-9 place-items-center rounded-[var(--radius-md)]"
        style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
      >
        <Icon size={18} />
      </span>
      <span className="text-[13px] font-semibold leading-tight text-ink">{spec.label}</span>
      {!isSource && (
        <span className="tabular text-[9px] text-muted">
          {spec.cap === Infinity ? "∞" : spec.cap}r/s · {spec.baseMs}ms
        </span>
      )}

      {/* utilization, shown after a run */}
      {d.util !== undefined && (
        <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-paper-sunken">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, d.util * 100)}%`, background: ring }} />
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!size-2 !border-2 !border-surface !bg-line-strong" />
    </div>
  );
}
