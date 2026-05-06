/**
 * Internal curation scheduler — runs inside the Railway container.
 *
 * 6 daily windows for Bangkok curation (BKK = UTC+7).
 * Feed day: 7:00pm BKK → 7:00pm BKK next day (UTC 12:00 → UTC 12:00).
 *
 *   Run 1  BKK 11:00pm  (UTC 16:00)  pulls 7:00pm–11:00pm
 *   Run 2  BKK  3:00am  (UTC 20:00)  pulls 11:00pm–3:00am
 *   Run 3  BKK  7:00am  (UTC 00:00)  pulls 3:00am–7:00am
 *   Run 4  BKK 11:00am  (UTC 04:00)  pulls 7:00am–11:00am
 *   Run 5  BKK  3:00pm  (UTC 08:00)  pulls 11:00am–3:00pm
 *   Run 6  BKK  7:00pm  (UTC 12:00)  pulls full 24h BKK day  ← FINAL (Claude publishes)
 *
 * Runs 1-5: shortlistOnly — accumulate candidates in Supabase, skip Claude.
 * Run 6: window expands to full 24h BKK feed day so Claude sees ALL articles, not just
 *        the last 4h. RSS feeds keep 24-48h of articles so this reliably covers W1-W5.
 */

import cron from "node-cron";
import { triggerRefresh } from "./article-store.js";

const WINDOW_HOURS = 4;
const OVERLAP_SECONDS = 1800; // 30-min backward overlap to catch boundary articles

/**
 * Compute the window boundaries by flooring current UTC to the nearest
 * 4-hour boundary. This matches the GitHub Actions bash logic exactly,
 * keeping window definitions stable regardless of when exactly the cron fires.
 */
function computeWindow(): { windowStart: Date; windowEnd: Date; shortlistOnly: boolean } {
  const nowMs = Date.now();
  const boundaryMs = WINDOW_HOURS * 3600 * 1000;

  const windowEndMs = Math.floor(nowMs / boundaryMs) * boundaryMs;
  const windowEnd = new Date(windowEndMs);

  // Run 6 is the final window — UTC boundary 12:00 (BKK 7:00pm).
  const windowEndHour = windowEnd.getUTCHours();
  const shortlistOnly = windowEndHour !== 12;

  // Final window (Run 6): expand to the full 24h BKK feed day so Claude sees ALL
  // articles from the day, not just the last 4h slice.
  // Shortlist windows (Runs 1-5): standard 4h + 30min overlap.
  const windowStartMs = shortlistOnly
    ? windowEndMs - boundaryMs - OVERLAP_SECONDS * 1000
    : windowEndMs - 24 * 3600 * 1000;

  const windowStart = new Date(windowStartMs);

  return { windowStart, windowEnd, shortlistOnly };
}

function runWindow(label: string): void {
  const { windowStart, windowEnd, shortlistOnly } = computeWindow();
  console.log(
    `[scheduler] ${label} fired — window ${windowStart.toISOString()} → ${windowEnd.toISOString()} shortlistOnly=${shortlistOnly}`,
  );
  triggerRefresh(windowStart, true, windowEnd, shortlistOnly);
}

export function startCurationScheduler(): void {
  // All times are UTC (Railway container clock).
  cron.schedule("0 16 * * *", () => runWindow("Run 1 (BKK 11pm)"), { timezone: "UTC" });
  cron.schedule("0 20 * * *", () => runWindow("Run 2 (BKK  3am)"), { timezone: "UTC" });
  cron.schedule("0  0 * * *", () => runWindow("Run 3 (BKK  7am)"), { timezone: "UTC" });
  cron.schedule("0  4 * * *", () => runWindow("Run 4 (BKK 11am)"), { timezone: "UTC" });
  cron.schedule("0  8 * * *", () => runWindow("Run 5 (BKK  3pm)"), { timezone: "UTC" });
  cron.schedule("0 12 * * *", () => runWindow("Run 6 (BKK  7pm FINAL)"), { timezone: "UTC" });

  console.log("[scheduler] Curation schedule active — 6 windows daily (UTC 16,20,0,4,8,12)");
}
