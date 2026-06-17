"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/app/lib/cn";
import { spring, tap } from "@/app/lib/motion";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-sans font-semibold " +
  "rounded-[var(--radius-md)] select-none cursor-pointer transition-colors " +
  "disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-paper";

const variants: Record<Variant, string> = {
  // tactile cobalt with chunky bottom edge
  primary:
    "bg-brand text-white shadow-pop-brand hover:bg-brand-press active:translate-y-[2px] active:shadow-none",
  secondary:
    "bg-surface text-ink border border-line-strong shadow-pop hover:bg-paper-sunken active:translate-y-[2px] active:shadow-none",
  ghost:
    "bg-transparent text-ink-soft hover:bg-paper-sunken",
  danger:
    "bg-bottleneck text-white shadow-[0_3px_0_0_#b81f24] hover:brightness-95 active:translate-y-[2px] active:shadow-none",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-7 text-lg",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileTap={tap}
      transition={spring.pop}
      className={cn(base, variants[variant], sizes[size], className)}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}
