import { simulate, type Graph } from "@sdq/sim-engine";
import { TINYURL } from "@/app/play/level-data";

/**
 * Server-side score verification (PRD §5.4): the backend re-runs the SAME engine
 * over the submitted { graph, seed } and returns its own result — the client's
 * reported score is never trusted. Hosted in the Next app for now; moves to the
 * Nest backend for V2.
 *
 * TODO: source levels from the engine (a level registry) instead of importing the
 * client's UI level-data, so this route doesn't pull in presentation code.
 */
const LEVELS = { [TINYURL.id]: TINYURL } as const;

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

  const level = LEVELS[levelId as keyof typeof LEVELS];
  if (!level) {
    return Response.json({ error: `Unknown level: ${levelId}` }, { status: 404 });
  }

  const result = simulate(graph, level, seed);
  return Response.json(result);
}
