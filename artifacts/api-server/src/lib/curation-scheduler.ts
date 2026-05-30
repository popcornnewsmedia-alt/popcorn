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
 *   Run 6  BKK  7:00pm  (UTC 12:00)  pulls 3:00pm–7:00pm    ← FINAL (Claude publishes)
 *
 * Runs 1-5: shortlistOnly — per-window consideration pass, accumulate "considered"
 *           candidates in Supabase, defer final selection.
 * Run 6: same 4h slice as the others for its own consideration pass, THEN loads the
 *        full day's accumulated "considered" pool (all 6 windows) from Supabase and runs
 *        Claude's final cut + enrichment. The 6 windows tile the 24h feed day cleanly
 *        (only the 30-min boundary overlap). No 24h re-fetch safety net — the final pool
 *        is exactly what W1-W6 each persisted.
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

  // All windows (Runs 1-6) use the same 4h + 30min-overlap slice so they tile the
  // 24h feed day cleanly. Run 6's own consideration pass covers only 3pm–7pm; its
  // final selection then reads the full day's accumulated "considered" pool from
  // Supabase (see rss-enricher.ts W6 final-selection stage), so it still sees every window.
  const windowStartMs = windowEndMs - boundaryMs - OVERLAP_SECONDS * 1000;

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
