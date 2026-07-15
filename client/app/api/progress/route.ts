import { auth0 } from "@/app/lib/auth0";
import { supabaseAdmin } from "@/app/lib/supabase-server";
import type { LevelProgress } from "@/app/store/progress.slice";

/** Server-side progress store, keyed by the Auth0 session — this is what makes
    the login gate's "your progress stays tied to you" promise (LoginGateModal)
    actually true across devices, instead of just localStorage. */

export async function GET() {
  const session = await auth0.getSession();
  if (!session?.user) return Response.json({ byLevelId: {} });

  const { data, error } = await supabaseAdmin
    .from("progress")
    .select("level_id, passed, best_score, stars_earned, stars_total")
    .eq("user_id", session.user.sub);

  if (error) {
    console.error("[progress GET] failed:", error.message);
    return Response.json({ byLevelId: {} }, { status: 500 });
  }

  const byLevelId: Record<string, LevelProgress> = {};
  for (const row of data ?? []) {
    byLevelId[row.level_id] = {
      passed: row.passed,
      bestScore: row.best_score,
      starsEarned: row.stars_earned,
      starsTotal: row.stars_total,
    };
  }
  return Response.json({ byLevelId });
}

interface ProgressUpdate {
  levelId: string;
  score: number;
  starsEarned: number;
  starsTotal: number;
}

export async function POST(req: Request) {
  const session = await auth0.getSession();
  if (!session?.user) return Response.json({ error: "Not logged in" }, { status: 401 });

  let body: ProgressUpdate;
  try {
    body = (await req.json()) as ProgressUpdate;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { levelId, score, starsEarned, starsTotal } = body;
  if (!levelId || typeof score !== "number") {
    return Response.json({ error: "Expected { levelId, score, starsEarned, starsTotal }" }, { status: 400 });
  }

  const userId = session.user.sub;

  // Read-then-write "keep the best" merge — a level re-played with a lower score
  // (or an out-of-order request) must never regress a previously recorded best.
  const { data: existing } = await supabaseAdmin
    .from("progress")
    .select("best_score, stars_earned, stars_total")
    .eq("user_id", userId)
    .eq("level_id", levelId)
    .maybeSingle();

  const merged = {
    passed: true,
    best_score: Math.max(existing?.best_score ?? 0, score),
    stars_earned: Math.max(existing?.stars_earned ?? 0, starsEarned ?? 0),
    stars_total: Math.max(existing?.stars_total ?? 0, starsTotal ?? 0),
  };

  const { error } = await supabaseAdmin.from("progress").upsert(
    { user_id: userId, level_id: levelId, ...merged, updated_at: new Date().toISOString() },
    { onConflict: "user_id,level_id" },
  );

  if (error) {
    console.error("[progress POST] failed:", error.message);
    return Response.json({ error: "Failed to save progress" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
