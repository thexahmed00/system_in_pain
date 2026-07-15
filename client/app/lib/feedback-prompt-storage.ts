const KEY = "sdq.feedback-prompt-shown.v1";

/** One-time-ever (not per-session) — unlike the mobile/cookie banners, this
    should never reappear once shown, regardless of future visits. */
export function hasSeenFeedbackPrompt(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return true; // private mode / disabled storage — don't nag every load
  }
}

export function markFeedbackPromptSeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // ignore
  }
}
