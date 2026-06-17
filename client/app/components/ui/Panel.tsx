"use client";

import * as React from "react";
import { cn } from "@/app/lib/cn";

/**
 * Panel — a labeled region for the 3-pane play screen (Question | Canvas | Components).
 * Full-height column with a sticky header and scrollable body.
 */
interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  kicker?: string;
  /** content pinned to the right of the header */
  action?: React.ReactNode;
  bodyClassName?: string;
}

export function Panel({
  title,
  kicker,
  action,
  className,
  bodyClassName,
  children,
  ...props
}: PanelProps) {
  return (
    <section
      className={cn(
        "flex flex-col h-full min-h-0 bg-surface border border-line rounded-[var(--radius-lg)] shadow-sm overflow-hidden",
        className,
      )}
      {...props}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line bg-paper/60 backdrop-blur-sm">
          <div className="min-w-0">
            {kicker && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                {kicker}
              </p>
            )}
            {title && (
              <h2 className="text-base font-display font-bold text-ink truncate">{title}</h2>
            )}
          </div>
          {action}
        </header>
      )}
      <div className={cn("flex-1 min-h-0 overflow-auto p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
