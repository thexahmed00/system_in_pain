const LAST_SHOWN_KEY = "sdq.feedback-prompt-last-shown-level.v2";
const LEVELS_BETWEEN_PROMPTS = 3;

/** Recurring, not one-time-ever: re-arms every LEVELS_BETWEEN_PROMPTS levels
    passed, so an engaged player who keeps advancing gets asked again — but a
    player who bounces after one or two levels never sees it a second time.
    Persisted (not session-scoped) so "keeps playing" spans return visits too,
    not just one sitting. Default of -1 makes the first-ever trigger land at
    levelIdx 2 (Level 3), matching the original one-time design's timing. */
export function shouldShowFeedbackPrompt(currentLevelIdx: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(LAST_SHOWN_KEY);
    const lastShownIdx = raw ? parseInt(raw, 10) : -1;
    return currentLevelIdx - lastShownIdx >= LEVELS_BETWEEN_PROMPTS;
  } catch {
    return false; // private mode / disabled storage — don't nag every load
  }
}

export function markFeedbackPromptShown(currentLevelIdx: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_SHOWN_KEY, String(currentLevelIdx));
  } catch {
    // ignore
  }
}
