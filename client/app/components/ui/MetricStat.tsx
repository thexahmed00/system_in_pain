"use client";

import * as React from "react";
import { cn } from "@/app/lib/cn";

type Status = "healthy" | "load" | "bottleneck" | "neutral";

const statusColor: Record<Status, string> = {
  healthy: "text-healthy",
  load: "text-load",
  bottleneck: "text-bottleneck",
  neutral: "text-ink",
};

interface MetricStatProps {
  label: string;
  value: string | number;
  unit?: string;
  /** drives the value color — tie to win-condition pass/fail in the sim */
  status?: Status;
  className?: string;
}

/** Numeric sim readout — tabular mono so digits don't jitter as values update. */
export function MetricStat({ label, value, unit, status = "neutral", className }: MetricStatProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      <span className={cn("tabular text-2xl font-bold leading-none", statusColor[status])}>
        {value}
        {unit && <span className="text-sm font-medium text-muted ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}
