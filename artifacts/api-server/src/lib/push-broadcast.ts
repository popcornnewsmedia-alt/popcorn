/**
 * Fan-out helper — broadcast "Your Popcorn is ready" to every iOS device when
 * a daily feed promotes to prod. Fire-and-forget; never blocks the API response.
 *
 * Strategy:
 *   1. Page through push_devices (iOS only) in chunks of 200.
 *   2. Per chunk, hand 50 tokens at a time to apns-sender, with concurrency 5.
 *   3. Log each delivery to push_deliveries (status sent | invalid_token | error).
 *   4. Delete any invalid-token rows so future runs don't waste effort.
 */
import { supabase } from "./supabase-client.js";
import { sendFeedReady, type SendResult } from "./apns-sender.js";

interface DeviceRow {
  id: number;
  device_token: string;
}

const PAGE_SIZE     = 200;
const BATCH_SIZE    = 50;
const BATCH_CONCURR = 5;

async function pMapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function broadcastFeedReady(feedDate: string): Promise<{
  attempted: number;
  sent: number;
  invalid: number;
  errored: number;
}> {
  if (process.env.PUSH_ENABLED !== "true") {
    console.log(`[push] PUSH_ENABLED!=true — skipping broadcast for ${feedDate}`);
    return { attempted: 0, sent: 0, invalid: 0, errored: 0 };
  }

  let totalAttempted = 0;
  let totalSent      = 0;
  let totalInvalid   = 0;
  let totalErrored   = 0;

  // Page through devices to avoid huge selects when the install base grows.
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("push_devices")
      .select("id, device_token")
      .eq("platform", "ios")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("[push] device select failed:", error.message);
      break;
    }
    const rows = (data ?? []) as DeviceRow[];
    if (!rows.length) break;

    const byToken = new Map<string, number>();
    for (const r of rows) byToken.set(r.device_token, r.id);

    const batches = chunk(rows.map(r => r.device_token), BATCH_SIZE);
    const results: SendResult[] = await pMapLimit(batches, BATCH_CONCURR, batch =>
      sendFeedReady({ deviceTokens: batch, feedDate }),
    );

    // Aggregate per-page results + write deliveries / prune.
    const deliveries: Array<{
      device_id: number | null;
      feed_date: string;
      status: "sent" | "invalid_token" | "error";
      apns_id: string | null;
      error: string | null;
    }> = [];
    const invalidIds: number[] = [];

    for (let bi = 0; bi < batches.length; bi++) {
      const result = results[bi];
      totalSent    += result.sent;
      totalInvalid += result.invalidTokens.length;
      totalErrored += result.errors.length;
      totalAttempted += batches[bi].length;

      for (const token of batches[bi]) {
        const id = byToken.get(token) ?? null;
        if (result.invalidTokens.includes(token)) {
          if (id !== null) invalidIds.push(id);
          deliveries.push({ device_id: id, feed_date: feedDate, status: "invalid_token", apns_id: null, error: null });
          continue;
        }
        const err = result.errors.find(e => e.token === token);
        if (err) {
          deliveries.push({ device_id: id, feed_date: feedDate, status: "error", apns_id: null, error: err.reason });
          continue;
        }
        deliveries.push({
          device_id: id,
          feed_date: feedDate,
          status:    "sent",
          apns_id:   result.apnsIds[token] ?? null,
          error:     null,
        });
      }
    }

    if (deliveries.length) {
      const { error: insertErr } = await supabase.from("push_deliveries").insert(deliveries);
      if (insertErr) console.error("[push] delivery insert failed:", insertErr.message);
    }
    if (invalidIds.length) {
      const { error: delErr } = await supabase.from("push_devices").delete().in("id", invalidIds);
      if (delErr) console.error("[push] invalid-token prune failed:", delErr.message);
    }

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log(
    `[push] feedDate=${feedDate} attempted=${totalAttempted} sent=${totalSent} invalid=${totalInvalid} errored=${totalErrored}`,
  );
  return { attempted: totalAttempted, sent: totalSent, invalid: totalInvalid, errored: totalErrored };
}

/**
 * Target push at a single user (for /api/push/test). Same logging behavior as
 * broadcastFeedReady, just scoped.
 */
export async function broadcastFeedReadyToUser(
  userId: string,
  feedDate: string,
): Promise<{ attempted: number; sent: number; invalid: number; errored: number }> {
  const { data, error } = await supabase
    .from("push_devices")
    .select("id, device_token")
    .eq("user_id", userId)
    .eq("platform", "ios");
  if (error) {
    console.error("[push/test] device select failed:", error.message);
    return { attempted: 0, sent: 0, invalid: 0, errored: 0 };
  }
  const rows = (data ?? []) as DeviceRow[];
  if (!rows.length) {
    console.log(`[push/test] no devices registered for user=${userId}`);
    return { attempted: 0, sent: 0, invalid: 0, errored: 0 };
  }

  const tokens = rows.map(r => r.device_token);
  const result = await sendFeedReady({ deviceTokens: tokens, feedDate });

  const byToken = new Map<string, number>(rows.map(r => [r.device_token, r.id]));
  const deliveries = tokens.map(token => {
    const id = byToken.get(token) ?? null;
    if (result.invalidTokens.includes(token))
      return { device_id: id, feed_date: feedDate, status: "invalid_token" as const, apns_id: null, error: null };
    const err = result.errors.find(e => e.token === token);
    if (err)
      return { device_id: id, feed_date: feedDate, status: "error" as const, apns_id: null, error: err.reason };
    return {
      device_id: id,
      feed_date: feedDate,
      status:    "sent" as const,
      apns_id:   result.apnsIds[token] ?? null,
      error:     null,
    };
  });

  if (deliveries.length) await supabase.from("push_deliveries").insert(deliveries);
  if (result.invalidTokens.length) {
    const invalidIds = rows.filter(r => result.invalidTokens.includes(r.device_token)).map(r => r.id);
    if (invalidIds.length) await supabase.from("push_devices").delete().in("id", invalidIds);
  }

  console.log(
    `[push/test] user=${userId} feedDate=${feedDate} attempted=${tokens.length} sent=${result.sent} invalid=${result.invalidTokens.length} errored=${result.errors.length}`,
  );
  return {
    attempted: tokens.length,
    sent:      result.sent,
    invalid:   result.invalidTokens.length,
    errored:   result.errors.length,
  };
}
