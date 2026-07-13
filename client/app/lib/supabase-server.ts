import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role key bypasses RLS — this client must never be imported into
// client components or exposed to the browser bundle. There is no Supabase
// Auth session here (Auth0 owns identity); access control is just "only
// trusted server code holds this key," not RLS policies keyed on auth.uid().
// Vercel auto-prefixed these with the integration name ("Supabase_") to avoid
// colliding with an earlier, now-unused connection's unprefixed vars.
export const supabaseAdmin = createClient(
  process.env.Supabase_SUPABASE_URL!,
  process.env.Supabase_SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
