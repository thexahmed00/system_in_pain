import { simulate, type Graph } from "@sdq/sim-engine";
import { LEVELS_BY_ID } from "@/app/play/level-data";
import { getPostHogClient } from "@/app/lib/posthog-server";

/**
 * Server-side score verification (PRD §5.4): the backend re-runs the SAME engine
 * over the submitted { graph, seed } and returns its own result — the client's
 * reported score is never trusted. Hosted in the Next app for now; moves to the
 * Nest backend for V2.
 *
 * TODO: source levels from the engine (a level registry) instead of importing the
 * client's UI level-data, so this route doesn't pull in presentation code.
 */

interface SimulateRequest {
  graph: Graph;
  levelId: string;
  seed?: number;
}

export async function POST(req: Request) {
  let body: SimulateRequest;
  try {
    body = (await req.json()) as SimulateRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { graph, levelId, seed } = body;
  if (!graph || !levelId) {
    return Response.json({ error: "Expected { graph, levelId }" }, { status: 400 });
  }

  const level = LEVELS_BY_ID[levelId];
  if (!level) {
    return Response.json({ error: `Unknown level: ${levelId}` }, { status: 404 });
  }

  const result = simulate(graph, level, seed);

  const distinctId = req.headers.get("x-posthog-distinct-id") ?? "anon";
  const posthog = getPostHogClient();
  posthog.capture({
    distinctId,
    event: "simulation_verified",
    properties: {
      level_id: levelId,
      passed: result.passed,
      score: result.final,
      node_count: graph.nodes.length,
      edge_count: graph.edges.length,
    },
  });

  return Response.json(result);
}
