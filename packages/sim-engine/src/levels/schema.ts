import { z } from "zod";

/* Zod schema for the level DSL. A level that can't drive a sim is a content bug,
   so validation is strict. */
export const trafficSchema = z.object({
  profile: z.string(),
  ratePerMin: z.number().positive(),
  readWriteRatio: z.number().min(0).max(1),
});

export const winConditionsSchema = z.object({
  p99LatencyMs: z.number().positive(),
  availability: z.number().min(0).max(1),
  maxCostPerHour: z.number().nonnegative(),
});

export const levelSchema = z.object({
  id: z.string(),
  stage: z.number().int().positive(),
  title: z.string(),
  story: z.string(),
  traffic: trafficSchema,
  allowedComponents: z.array(z.string()).min(1),
  failureInjections: z.array(z.unknown()).default([]),
  winConditions: winConditionsSchema,
  concepts: z.array(z.string()).default([]),
});

export type LevelInput = z.input<typeof levelSchema>;
