"use client";

import * as React from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import posthog from "posthog-js";

/** Ties PostHog's anonymous session to the signed-in Auth0 account, so logged-in
    players show up as identified people (not just anonymous distinct_ids) in
    PostHog. Resets back to anonymous on logout so the next visitor on this
    browser isn't attributed to the previous account. */
export function PostHogIdentify() {
  const { user } = useUser();
  const identified = React.useRef(false);

  React.useEffect(() => {
    if (user) {
      posthog.identify(user.sub, {
        email: user.email,
        name: user.name,
        picture: user.picture,
      });
      identified.current = true;
    } else if (identified.current) {
      posthog.reset();
      identified.current = false;
    }
  }, [user]);

  return null;
}
