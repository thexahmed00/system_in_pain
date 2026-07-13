import { NextResponse } from "next/server";
import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { syncProfile } from "@/app/lib/sync-profile";

// Preview deployments get a unique URL per build, so APP_BASE_URL is only set
// for Production/Development; Preview falls back to Vercel's auto-injected
// VERCEL_URL (the deployment's own domain).
const appBaseUrl =
  process.env.APP_BASE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  secret: process.env.AUTH0_SECRET!,
  appBaseUrl,
  async onCallback(error, ctx, session) {
    if (error) {
      return new NextResponse(error.message, { status: 500 });
    }
    if (session?.user) {
      await syncProfile(session.user);
    }
    return NextResponse.redirect(new URL(ctx.returnTo || "/", ctx.appBaseUrl));
  },
});
