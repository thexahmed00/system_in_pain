import type { Variants, Transition } from "motion/react";

/* =========================================================================
   MOTION PRESETS — System Design Quest
   One shared vocabulary so animation feels intentional, not scattered.
   Library: `motion` v12 (import from "motion/react").
   ========================================================================= */

/** Springs — the house feel. `pop` is the signature tactile spring. */
export const spring = {
  pop:    { type: "spring", stiffness: 520, damping: 30, mass: 0.8 },
  gentle: { type: "spring", stiffness: 260, damping: 28 },
  soft:   { type: "spring", stiffness: 170, damping: 26 },
} satisfies Record<string, Transition>;

export const ease = {
  out:    [0.16, 1, 0.3, 1] as const,   // expressive ease-out
  inOut:  [0.65, 0, 0.35, 1] as const,
};

/* ---- Page-load orchestration: stagger children, each rises + fades in ---- */
export const stagger = (gap = 0.06, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: ease.out } },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.4, ease: ease.out } },
};

/** Pop-in for tactile elements (cards, badges, medals). */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 8 },
  show:   { opacity: 1, scale: 1, y: 0, transition: spring.pop },
};

/* ---- Interaction primitives reused across buttons / cards ---- */
export const tap = { scale: 0.96 } as const;
export const hoverLift = { y: -2 } as const;

/** Count-up spring for score numbers (use with useSpring/animate). */
export const scoreSpring: Transition = { type: "spring", stiffness: 90, damping: 18 };
