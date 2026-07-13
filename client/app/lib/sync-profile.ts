import "server-only";
import type { User } from "@auth0/nextjs-auth0/types";
import { supabaseAdmin } from "@/app/lib/supabase-server";

/** Upserts the Auth0 profile into Supabase's `profiles` table, keyed by the
    Auth0 `sub`. Called once per login (from auth0.ts's onCallback), not on
    every request. */
export async function syncProfile(user: User) {
  const { error } = await supabaseAdmin.from("profiles").upsert(
    {
      id: user.sub,
      email: user.email ?? null,
      name: user.name ?? null,
      picture: user.picture ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("[syncProfile] failed to upsert profile:", error.message);
  }
}
