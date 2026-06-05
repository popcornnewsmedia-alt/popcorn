/**
 * Tiny pub/sub for "the daily feed just promoted to prod" signal.
 *
 * Producers (push-registration.ts):
 *   • On a foreground push, call flagFeedReady() — synchronously sets a session
 *     storage key + fires a window event. The currently-mounted overlay listens
 *     for the event and pops immediately.
 *   • On a background push (tap from banner), call flagFeedReady() right before
 *     navigation — the overlay reads the sessionStorage flag on mount.
 *
 * Consumer (PopcornReadyOverlay.tsx):
 *   • Listens for the "popcornFeedReady" custom event while mounted.
 *   • On mount, calls consumeFeedReadyFlag() — if the flag was set, the overlay
 *     plays once and clears the flag so a second mount doesn't replay it.
 */

const STORAGE_KEY = "feedReadyJustOpened";
const EVENT_NAME  = "popcornFeedReady";

export function flagFeedReady(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* sessionStorage may be unavailable in private mode — fall back to event-only */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
}

export function consumeFeedReadyFlag(): boolean {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    if (v === "1") {
      sessionStorage.removeItem(STORAGE_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export const FEED_READY_EVENT = EVENT_NAME;
