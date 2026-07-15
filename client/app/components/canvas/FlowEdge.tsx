"use client";

import {
  BaseEdge, EdgeLabelRenderer, getBezierPath, useInternalNode,
  Position, type EdgeProps, type InternalNode,
} from "@xyflow/react";
import { X } from "lucide-react";
import { useAppDispatch } from "@/app/store/hooks";
import { edgesChanged, healthCleared } from "@/app/store/architecture.slice";
import { simCleared } from "@/app/store/sim.slice";

/* Premium flow connector. A softly-lit curve that FLOATS — it attaches to the nearest
   side of each node (so vertical links stay vertical and side-by-side links go horizontal),
   colour-encodes what flowed through it (blue reads · amber writes · purple both), streams
   request particles, and carries a delete button when selected. No text labels. */

type FlowKind = "read" | "write" | "mixed" | "idle";
const STROKE: Record<FlowKind, string> = { read: "#2563eb", write: "#d97706", mixed: "#7c3aed", idle: "var(--line-strong)" };
const PARTICLES: Record<Exclude<FlowKind, "idle">, string[]> = { read: ["#2563eb"], write: ["#d97706"], mixed: ["#2563eb", "#d97706"] };
const DOTS = 3;
const DUR = 1.6;

// ---- floating geometry: anchor the edge to the nearest point on each node's border ----
// Inputs are rounded to whole pixels before any math runs. `measured`/`positionAbsolute`
// can report sub-pixel-different values across renders that trigger for reasons unrelated
// to an actual move (viewport transform rounding, ResizeObserver noise) — without this,
// identical-looking renders produce a fractionally different path each time, which shows
// up as the delete button visibly vibrating under a stationary cursor.
function intersection(a: InternalNode, b: InternalNode) {
  const w = Math.round(a.measured.width ?? 0) / 2, h = Math.round(a.measured.height ?? 0) / 2;
  const ax = Math.round(a.internals.positionAbsolute.x) + w, ay = Math.round(a.internals.positionAbsolute.y) + h;
  const bx = Math.round(b.internals.positionAbsolute.x) + Math.round(b.measured.width ?? 0) / 2;
  const by = Math.round(b.internals.positionAbsolute.y) + Math.round(b.measured.height ?? 0) / 2;
  const xx = (bx - ax) / (2 * w) - (by - ay) / (2 * h);
  const yy = (bx - ax) / (2 * w) + (by - ay) / (2 * h);
  const k = 1 / (Math.abs(xx) + Math.abs(yy) || 1);
  return { x: Math.round(w * (k * xx + k * yy) + ax), y: Math.round(h * (-k * xx + k * yy) + ay) };
}
function sideOf(node: InternalNode, x: number, y: number): Position {
  const nx = Math.round(node.internals.positionAbsolute.x), ny = Math.round(node.internals.positionAbsolute.y);
  const nw = Math.round(node.measured.width ?? 0);
  if (Math.round(x) <= nx + 1) return Position.Left;
  if (Math.round(x) >= nx + nw - 1) return Position.Right;
  if (Math.round(y) <= ny + 1) return Position.Top;
  return Position.Bottom;
}

export function FlowEdge({ id, source, target, selected, data, ...fallback }: EdgeProps) {
  const dispatch = useAppDispatch();
  const s = useInternalNode(source);
  const t = useInternalNode(target);

  let path: string, labelX: number, labelY: number;
  if (s?.measured?.width && t?.measured?.width) {
    const si = intersection(s, t), ti = intersection(t, s);
    [path, labelX, labelY] = getBezierPath({
      sourceX: si.x, sourceY: si.y, sourcePosition: sideOf(s, si.x, si.y),
      targetX: ti.x, targetY: ti.y, targetPosition: sideOf(t, ti.x, ti.y),
    });
  } else {
    // pre-measure fallback: use the handle coords React Flow passed in
    const f = fallback as unknown as { sourceX: number; sourceY: number; targetX: number; targetY: number; sourcePosition: Position; targetPosition: Position };
    [path, labelX, labelY] = getBezierPath(f);
  }

  const kind = ((data?.kind as FlowKind) ?? "idle");
  const active = kind !== "idle";
  const color = STROKE[kind];
  const palette = active ? PARTICLES[kind as Exclude<FlowKind, "idle">] : [];

  const remove = () => {
    dispatch(edgesChanged([{ id, type: "remove" }]));
    dispatch(simCleared());
    dispatch(healthCleared());
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: selected ? "var(--brand)" : color,
          strokeWidth: selected ? 3 : active ? 2 : 1.5,
          strokeLinecap: "round",
          opacity: active || selected ? 0.95 : 0.45,
          filter: active ? `drop-shadow(0 0 4px ${color}55)` : undefined,
          transition: "stroke .35s ease, opacity .35s ease, stroke-width .2s ease",
        }}
      />
      {active &&
        Array.from({ length: DOTS }).map((_, i) => {
          const c = palette[i % palette.length];
          return (
            <circle key={i} r={2.6} fill={c} style={{ filter: `drop-shadow(0 0 3px ${c})`, pointerEvents: "none" }}>
              <animateMotion dur={`${DUR}s`} begin={`${(i / DOTS) * DUR}s`} repeatCount="indefinite" path={path} />
            </circle>
          );
        })}
      {selected && (
        <EdgeLabelRenderer>
          <button
            type="button"
            onClick={remove}
            title="Delete connection"
            className="nodrag nopan grid size-6 place-items-center rounded-full border border-line bg-surface text-bottleneck shadow-pop transition-colors hover:bg-bottleneck-soft"
            style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
