import { Capacitor } from "@capacitor/core";

// Canonical public origin. Shared links must always point at the website so a
// recipient WITHOUT the app can open and read the article in any browser — the
// native app's own origin (capacitor://localhost) is never shareable.
export const SITE_ORIGIN = "https://popcornmedia.org";

/** The shareable, app-less-friendly URL for a given article. */
export function articleShareUrl(id: number): string {
  return `${SITE_ORIGIN}/a/${id}`;
}

export type ShareResult = "shared" | "copied" | "cancelled";

interface ShareableArticle {
  id: number;
  title: string;
  summary?: string | null;
}

/**
 * Shares an article through the best channel for the platform:
 *   • Native app  → the real iOS share sheet (@capacitor/share) across all apps.
 *   • Mobile web  → the browser's Web Share API (also a native sheet on iOS/Android).
 *   • Desktop web → copies the link to the clipboard.
 *
 * Returns what actually happened so the caller can show "Link copied" feedback
 * on the desktop/clipboard path. Cancellations (user dismissed the sheet) and
 * failures resolve to "cancelled" — never throw.
 */
export async function shareArticle(article: ShareableArticle): Promise<ShareResult> {
  const url = articleShareUrl(article.id);
  const title = article.title;
  const text = article.summary ?? article.title;

  // 1. Native app → Capacitor Share plugin.
  if (Capacitor.isNativePlatform()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title, text, url, dialogTitle: "Share article" });
      return "shared";
    } catch {
      // User cancelled the sheet, or the plugin is unavailable — fall through
      // and try the clipboard so the action is never a dead end.
    }
  }

  // 2. Mobile web (and any browser exposing the Web Share API) → native sheet.
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (err) {
      // AbortError = user dismissed the sheet; treat as a no-op, don't fall back.
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // Other failures → fall through to clipboard.
    }
  }

  // 3. Desktop / no share API → copy link.
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "cancelled";
  }
}
