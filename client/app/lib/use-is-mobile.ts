"use client";

import * as React from "react";

const BREAKPOINT = "(max-width: 767px)";

/** Starts `false` (matches SSR) and flips after mount once the real viewport
    is known — same tradeoff as the cookie/mobile-warning banners: a brief
    flash rather than a client/server hydration mismatch. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(BREAKPOINT);
    const evaluate = () => setIsMobile(mql.matches);
    evaluate();
    mql.addEventListener("change", evaluate);
    return () => mql.removeEventListener("change", evaluate);
  }, []);

  return isMobile;
}
