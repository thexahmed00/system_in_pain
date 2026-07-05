import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  applyNodeChanges, applyEdgeChanges, addEdge,
  type Node, type Edge, type NodeChange, type EdgeChange, type Connection,
} from "@xyflow/react";
import type { SimNodeResult, SimEdgeFlow, Graph } from "@sdq/sim-engine";

/** Flow class for an edge, from its observed read/write counts — drives FlowEdge's colour. */
const flowKind = (f?: SimEdgeFlow): "read" | "write" | "mixed" | "idle" =>
  !f || (f.reads === 0 && f.writes === 0)
    ? "idle"
    : f.reads > 0 && f.writes > 0
      ? "mixed"
      : f.writes > 0
        ? "write"
        : "read";

/** The architecture the player is building: the React Flow graph + selection. */
interface ArchitectureState {
  nodes: Node[];
  edges: Edge[];
  selected: string | null;
}

const initialNodes: Node[] = [
  { id: "client-1", type: "component", position: { x: 220, y: 40 }, data: { compType: "client" } },
];

const initialState: ArchitectureState = { nodes: initialNodes, edges: [], selected: null };

let nodeSeq = 2;

const compTypeOf = (n: Node) => (n.data as { compType: string }).compType;
const instancesOf = (n: Node) => (n.data as { instances?: number }).instances;

const slice = createSlice({
  name: "architecture",
  initialState,
  reducers: {
    nodesChanged(state, a: PayloadAction<NodeChange[]>) {
      state.nodes = applyNodeChanges(a.payload, state.nodes as Node[]);
    },
    edgesChanged(state, a: PayloadAction<EdgeChange[]>) {
      state.edges = applyEdgeChanges(a.payload, state.edges as Edge[]);
    },
    connected(state, a: PayloadAction<Connection>) {
      state.edges = addEdge({ ...a.payload, type: "flow", data: { kind: "idle" } }, state.edges as Edge[]);
    },
    nodeAdded(state, a: PayloadAction<{ type: string; position: { x: number; y: number } }>) {
      const id = `${a.payload.type}-${nodeSeq++}`;
      state.nodes.push({ id, type: "component", position: a.payload.position, data: { compType: a.payload.type } });
    },
    nodeDeleted(state, a: PayloadAction<string>) {
      state.nodes = state.nodes.filter((n) => n.id !== a.payload);
      state.edges = state.edges.filter((e) => e.source !== a.payload && e.target !== a.payload);
      state.selected = null;
    },
    selectedSet(state, a: PayloadAction<string | null>) {
      state.selected = a.payload;
    },
    /** set replica count on a node (horizontal scaling → engine config.instances) */
    instancesSet(state, a: PayloadAction<{ id: string; instances: number }>) {
      const n = state.nodes.find((x) => x.id === a.payload.id);
      if (n) n.data = { ...n.data, instances: Math.max(1, Math.round(a.payload.instances)) };
    },
    /** paint sim health onto node data after a run (preserve instances) */
    healthPainted(state, a: PayloadAction<SimNodeResult[]>) {
      for (const n of state.nodes) {
        const r = a.payload.find((x) => x.id === n.id);
        n.data = { compType: compTypeOf(n), instances: instancesOf(n), status: r?.status, util: r?.util };
      }
    },
    /** tag each edge with its read/write flow class after a run (FlowEdge colours it) */
    edgeFlowPainted(state, a: PayloadAction<SimEdgeFlow[]>) {
      const byKey = new Map(a.payload.map((f) => [`${f.source}->${f.target}`, f]));
      for (const e of state.edges) {
        e.type = "flow";
        e.data = { ...(e.data ?? {}), kind: flowKind(byKey.get(`${e.source}->${e.target}`)) };
      }
    },
    /** strip sim health + flow paint (on any edit), preserve instances */
    healthCleared(state) {
      for (const n of state.nodes) n.data = { compType: compTypeOf(n), instances: instancesOf(n) };
      for (const e of state.edges) {
        e.type = "flow";
        e.data = { ...(e.data ?? {}), kind: "idle" };
      }
    },
    graphReset(state) {
      state.nodes = initialNodes;
      state.edges = [];
      state.selected = null;
    },
    /** load a level's starter graph (pre-built canvas — e.g. L5 opens over-engineered) */
    graphSeeded(state, a: PayloadAction<Graph>) {
      state.nodes = a.payload.nodes.map((n, i) => ({
        id: n.id,
        type: "component",
        position: n.position ?? { x: 120 + i * 240, y: 200 },
        data: { compType: n.type, ...(n.config?.instances ? { instances: n.config.instances } : {}) },
      }));
      state.edges = a.payload.edges.map((e) => ({
        id: `${e.source}->${e.target}`,
        source: e.source,
        target: e.target,
        type: "flow",
        data: { kind: "idle" },
      }));
      state.selected = null;
    },
  },
});

export const {
  nodesChanged, edgesChanged, connected, nodeAdded, nodeDeleted,
  selectedSet, instancesSet, healthPainted, edgeFlowPainted, healthCleared, graphReset, graphSeeded,
} = slice.actions;
export default slice.reducer;
