import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// ── Shared state ──────────────────────────────────────────────────────────
// One module-level cache + one realtime channel, shared across every
// mounted consumer (e.g. every visible ArticleCard). This avoids N+1
// fetches and keeps counts live-accurate without per-card subscriptions.

const counts = new Map<number, number>();
const pending = new Set<number>();
const listeners = new Map<number, Set<() => void>>();
let channelReady = false;

function ensureChannel() {
  if (channelReady) return;
  channelReady = true;
  supabase
    .channel("comments:counts")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "comments" },
      (payload) => bump(Number((payload.new as { article_id: number }).article_id), +1),
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "comments" },
      (payload) => bump(Number((payload.old as { article_id: number }).article_id), -1),
    )
    .subscribe();
}

function bump(articleId: number, delta: number) {
  if (!counts.has(articleId)) return;  // Only mutate counts we've already hydrated.
  counts.set(articleId, Math.max(0, (counts.get(articleId) ?? 0) + delta));
  listeners.get(articleId)?.forEach((fn) => fn());
}

async function hydrate(articleId: number) {
  if (counts.has(articleId) || pending.has(articleId)) return;
  pending.add(articleId);
  const { count } = await supabase
    .from("comments")
    .select("id", { head: true, count: "exact" })
    .eq("article_id", articleId);
  pending.delete(articleId);
  counts.set(articleId, count ?? 0);
  listeners.get(articleId)?.forEach((fn) => fn());
}

export function useCommentCount(articleId: number | undefined | null): number | null {
  const [, tick] = useState(0);
  useEffect(() => {
    if (articleId == null) return;
    ensureChannel();
    let bucket = listeners.get(articleId);
    if (!bucket) {
      bucket = new Set();
      listeners.set(articleId, bucket);
    }
    const notify = () => tick((n) => n + 1);
    bucket.add(notify);
    hydrate(articleId);
    return () => {
      bucket?.delete(notify);
      if (bucket && bucket.size === 0) listeners.delete(articleId);
    };
  }, [articleId]);
  if (articleId == null) return null;
  return counts.has(articleId) ? counts.get(articleId)! : null;
}
