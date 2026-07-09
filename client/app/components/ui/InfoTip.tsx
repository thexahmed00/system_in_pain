"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/app/lib/cn";

interface InfoTipProps {
  text: string;
  className?: string;
}

/** Small (i) glyph — hover or focus reveals a plain-language definition of a jargon term. */
export function InfoTip({ text, className }: InfoTipProps) {
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      <Info
        size={12}
        tabIndex={0}
        aria-label={text}
        className="cursor-help text-muted transition-colors outline-none hover:text-brand focus-visible:text-brand"
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-[220px] -translate-x-1/2 rounded-[var(--radius-sm)] border border-line-strong bg-ink px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
