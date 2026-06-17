"use client";

import * as React from "react";
import { cn } from "@/app/lib/cn";

type Tone = "brand" | "neutral" | "healthy" | "load" | "bottleneck" | "fail";

const tones: Record<Tone, string> = {
  brand:      "bg-brand-soft text-brand-ink",
  neutral:    "bg-paper-sunken text-ink-soft",
  healthy:    "bg-healthy-soft text-[#1d7a4d]",
  load:       "bg-load-soft text-[#9a6512]",
  bottleneck: "bg-bottleneck-soft text-[#b3262b]",
  fail:       "bg-fail text-white",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** leading status dot in the tone's solid color */
  dot?: boolean;
}

const dotColor: Record<Tone, string> = {
  brand: "bg-brand",
  neutral: "bg-muted",
  healthy: "bg-healthy",
  load: "bg-load",
  bottleneck: "bg-bottleneck",
  fail: "bg-white",
};

export function Badge({ tone = "neutral", dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-tight",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dotColor[tone])} />}
      {children}
    </span>
  );
}
