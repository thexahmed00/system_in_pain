"use client";

import * as React from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { Button } from "@/app/components/ui";

const STORAGE_KEY = "sdq.cookie-consent.v1";

type Consent = "accepted" | "declined";

export function CookieConsent() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    let stored: Consent | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY) as Consent | null;
    } catch {
      // private mode / storage disabled — treat as no decision yet, but don't
      // nag every load since we can't persist a choice anyway.
      return;
    }

    if (stored === "accepted") {
      posthog.opt_in_capturing();
    } else if (stored === "declined") {
      posthog.opt_out_capturing();
    } else {
      setVisible(true);
    }
  }, []);

  function choose(consent: Consent) {
    try {
      localStorage.setItem(STORAGE_KEY, consent);
    } catch {
      // ignore — nothing more we can do in this environment
    }
    if (consent === "accepted") posthog.opt_in_capturing();
    else posthog.opt_out_capturing();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-[var(--radius-lg)] border border-line-strong bg-surface p-5 shadow-pop sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft">
          We use cookies for login sessions and product analytics.{" "}
          <Link href="/privacy" className="font-medium text-brand underline underline-offset-2">
            Privacy Policy
          </Link>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => choose("declined")}>
            Decline
          </Button>
          <Button variant="primary" size="sm" onClick={() => choose("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
