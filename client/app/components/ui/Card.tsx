"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/app/lib/cn";
import { popIn, hoverLift, spring } from "@/app/lib/motion";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** soft elevation level */
  elevation?: "flat" | "raised" | "floating";
  /** add hover lift (use for clickable cards) */
  interactive?: boolean;
  /** animate in with the pop-in variant */
  animate?: boolean;
}

const elevations = {
  flat: "shadow-none border-line",
  raised: "shadow-md border-line",
  floating: "shadow-lg border-line",
} as const;

export function Card({
  elevation = "raised",
  interactive = false,
  animate = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <motion.div
      variants={animate ? popIn : undefined}
      initial={animate ? "hidden" : undefined}
      animate={animate ? "show" : undefined}
      whileHover={interactive ? hoverLift : undefined}
      transition={spring.gentle}
      className={cn(
        "bg-surface border rounded-[var(--radius-lg)] p-5",
        elevations[elevation],
        interactive && "cursor-pointer",
        className,
      )}
      {...(props as React.ComponentProps<typeof motion.div>)}
    >
      {children}
    </motion.div>
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-display font-bold text-ink", className)} {...props} />;
}

export function CardKicker({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-xs font-semibold uppercase tracking-[0.14em] text-muted", className)}
      {...props}
    />
  );
}
