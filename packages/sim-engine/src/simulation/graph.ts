import type { Graph, GraphNode } from "../types";
import { modelOf } from "../components/models";

/* Reads the player's architecture map (boxes + arrows) and answers the questions
   the simulator keeps asking: where do requests start, where can a request go
   from a given box, and which boxes are endpoints. Built once per run. */

export interface GraphIndex {
  nodeById: (id: string) => GraphNode | undefined;
  /** boxes reachable by following arrows out of `id` */
  successors: (id: string) => GraphNode[];
  /** the Client(s) — where requests enter */
  sources: GraphNode[];
  /** true when a box has no outgoing arrows (a request leg ends here) */
  isTerminal: (id: string) => boolean;
}

export function indexGraph(graph: Graph): GraphIndex {
  const byId = new Map<string, GraphNode>();
  for (const n of graph.nodes) byId.set(n.id, n);

  const outIds = new Map<string, string[]>();
  for (const e of graph.edges) {
    const list = outIds.get(e.source) ?? [];
    list.push(e.target);
    outIds.set(e.source, list);
  }

  const successors = (id: string): GraphNode[] =>
    (outIds.get(id) ?? []).map((t) => byId.get(t)).filter((n): n is GraphNode => !!n);

  const sources = graph.nodes.filter((n) => modelOf(n.type)?.kind === "source");

  const isTerminal = (id: string): boolean => (outIds.get(id)?.length ?? 0) === 0;

  return { nodeById: (id) => byId.get(id), successors, sources, isTerminal };
}
