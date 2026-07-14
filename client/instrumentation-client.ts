import posthog from "posthog-js";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: "2026-01-30",
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development",
  // GDPR: no analytics capture until the cookie-consent banner opts the
  // visitor in (see app/components/marketing/CookieConsent.tsx). The Auth0
  // session cookie is unaffected — it's strictly necessary, not analytics.
  opt_out_capturing_by_default: true,
});
