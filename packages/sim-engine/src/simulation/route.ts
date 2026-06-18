import type { Graph, GraphNode } from "../types";
import { modelOf } from "../components/models";

/**
 * Linear route from the Client (source) to a terminal node, following edges.
 * v1: single path. Returns null if there's no source or no onward path.
 * (Branching DAGs arrive with the true event scheduler — see plan.)
 */
export function routeOf(graph: Graph): GraphNode[] | null {
  const src = graph.nodes.find((n) => modelOf(n.type)?.kind === "source");
  if (!src) return null;

  const out: Record<string, string[]> = {};
  for (const e of graph.edges) (out[e.source] ||= []).push(e.target);

  const path: GraphNode[] = [src];
  const seen = new Set([src.id]);
  let cur = src;
  while (out[cur.id]?.length) {
    const nextId = out[cur.id][0];
    if (seen.has(nextId)) break; // cycle guard
    const next = graph.nodes.find((n) => n.id === nextId);
    if (!next) break;
    path.push(next);
    seen.add(next.id);
    cur = next;
  }
  return path.length >= 2 ? path : null;
}
