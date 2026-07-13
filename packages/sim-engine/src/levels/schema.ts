import { z } from "zod";

/* Zod schema for the level DSL. A level that can't drive a sim is a content bug,
   so validation is strict. */
export const trafficSchema = z.object({
  profile: z.string(),
  ratePerMin: z.number().positive(),
  readWriteRatio: z.number().min(0).max(1),
  maliciousRatio: z.number().min(0).max(1).optional(),
});

/* Threshold vocabulary shared by all three gate tiers (PRD §7.1). Every field
   optional — a level/gate sets only what it tests. */
export const thresholdsSchema = z.object({
  minThroughputRps: z.number().nonnegative().optional(),
  maxErrorRate: z.number().min(0).max(1).optional(),
  p95LatencyMs: z.number().positive().optional(),
  p99LatencyMs: z.number().positive().optional(),
  availability: z.number().min(0).max(1).optional(),
  maxCostPerHour: z.number().nonnegative().optional(),
  maxRecoveryMs: z.number().nonnegative().optional(),
});

/* Scenario stressors — mirrors the FailureInjection union in types.ts. Validated
   strictly (discriminated on `kind`) so a malformed disaster — unknown kind, missing
   window, negative multiplier — is a load-time error, not a silent no-op in the sim.
   Every injection carries a window: atSecond ≥ 0, durationSec > 0 (a zero-length
   window never activates). */
const injectionWindow = { atSecond: z.number().nonnegative(), durationSec: z.number().positive() };
export const failureInjectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("spike"), ...injectionWindow, multiplier: z.number().positive() }),
  z.object({ kind: z.literal("node-down"), ...injectionWindow, nodeType: z.string().min(1) }),
  z.object({ kind: z.literal("latency-spike"), ...injectionWindow, addMs: z.number().nonnegative() }),
]);

export const scenarioGateSchema = z.object({
  name: z.string(),
  trafficMultiplier: z.number().positive().optional(),
  profile: z.string().optional(),
  mustMeet: thresholdsSchema,
});

export const resilienceGateSchema = z.object({
  inject: z.string(),
  mustMeet: thresholdsSchema,
});

export const winConditionsSchema = z.object({
  steady: thresholdsSchema,
  scenarios: z.array(scenarioGateSchema).default([]),
  resilience: z.array(resilienceGateSchema).default([]),
});

export const medalsSchema = z
  .object({ silver: thresholdsSchema.optional(), gold: thresholdsSchema.optional(), platinum: thresholdsSchema.optional() })
  .optional();

export const challengeSchema = z.object({
  id: z.string(),
  label: z.string(),
  hint: z.string(),
  maxCostPerHour: z.number().nonnegative().optional(),
  maxP99Ms: z.number().positive().optional(),
  maxComponents: z.number().int().positive().optional(),
  survivesMultiplier: z.number().positive().optional(),
  requireSecure: z.boolean().optional(),
});

/* Starter graph — a level that opens pre-built (e.g. over-engineered, so the player
   subtracts). Positions are canvas layout hints; the sim ignores them. */
export const graphSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      config: z.object({ instances: z.number().int().positive().optional() }).optional(),
      position: z.object({ x: z.number(), y: z.number() }).optional(),
    }),
  ),
  edges: z.array(z.object({ source: z.string(), target: z.string() })),
});

export const levelSchema = z.object({
  id: z.string(),
  stage: z.number().int().positive(),
  title: z.string(),
  story: z.string(),
  requirements: z
    .object({
      functional: z.array(z.string()).min(1),
      nonFunctional: z.array(z.string()).optional(),
      constraints: z.array(z.string()).optional(),
      outOfScope: z.array(z.string()).optional(),
    })
    .optional(),
  traffic: trafficSchema,
  allowedComponents: z.array(z.string()).min(1),
  failureInjections: z.array(failureInjectionSchema).default([]),
  winConditions: winConditionsSchema,
  medals: medalsSchema,
  challenges: z.array(challengeSchema).optional(),
  requireAppTier: z.boolean().optional(),
  requireWriteSplit: z.boolean().optional(),
  starterGraph: graphSchema.optional(),
  concepts: z.array(z.string()).default([]),
});

export type LevelInput = z.input<typeof levelSchema>;
