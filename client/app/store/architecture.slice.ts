import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  applyNodeChanges, applyEdgeChanges, addEdge,
  type Node, type Edge, type NodeChange, type EdgeChange, type Connection,
} from "@xyflow/react";
import type { SimNodeResult } from "@sdq/sim-engine";

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
      state.edges = addEdge({ ...a.payload, animated: true }, state.edges as Edge[]);
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
    /** paint sim health onto node data after a run */
    healthPainted(state, a: PayloadAction<SimNodeResult[]>) {
      for (const n of state.nodes) {
        const r = a.payload.find((x) => x.id === n.id);
        n.data = { compType: compTypeOf(n), status: r?.status, util: r?.util };
      }
    },
    /** strip sim health (on any edit) */
    healthCleared(state) {
      for (const n of state.nodes) n.data = { compType: compTypeOf(n) };
    },
    graphReset(state) {
      state.nodes = initialNodes;
      state.edges = [];
      state.selected = null;
    },
  },
});

export const {
  nodesChanged, edgesChanged, connected, nodeAdded, nodeDeleted,
  selectedSet, healthPainted, healthCleared, graphReset,
} = slice.actions;
export default slice.reducer;
