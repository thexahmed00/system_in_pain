"use client";

import * as React from "react";
import posthog from "posthog-js";

/** Catches a crash in the root layout itself (worse case than error.tsx — this
    replaces <html>/<body> entirely, so no Tailwind/globals.css can be trusted
    to be loaded; every style here is inline on purpose. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, display: "grid", placeItems: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif", background: "#fbfaf7", color: "#17161b" }}>
        <div style={{ textAlign: "center", maxWidth: 380, padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Something broke</h1>
          <p style={{ marginTop: 12, fontSize: 14, color: "#3d3b44", lineHeight: 1.5 }}>
            The app hit an unexpected error. Try reloading — if it keeps happening, let us know.
          </p>
          <button
            onClick={() => reset()}
            style={{ marginTop: 20, height: 40, padding: "0 20px", borderRadius: 10, background: "#355cff", color: "white", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 14 }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
