import type { Level } from "../types";
import { levelSchema } from "./schema";

/** Parse + validate raw level JSON into a typed Level. Throws on bad content. */
export function loadLevel(data: unknown): Level {
  return levelSchema.parse(data) as Level;
}
