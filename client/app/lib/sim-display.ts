import type { SimResult } from "@sdq/sim-engine";

/** Shared between the in-canvas result panel and the SuccessModal so both render
    the same dimension breakdown, in the same order, with the same color scale. */
export const DIM_LABELS: [keyof SimResult["dims"], string][] = [
  ["performance", "Performance"], ["reliability", "Reliability"],
  ["scalability", "Scalability"], ["cost", "Cost"], ["security", "Security"],
];

export function dimColor(v: number) {
  return v >= 80 ? "var(--healthy)" : v >= 50 ? "var(--load)" : "var(--bottleneck)";
}
