import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { DBNotification } from "@/lib/comments-types";

interface UseNotificationsResult {
  items: DBNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

/**
 * Fetches the signed-in user's notifications and subscribes to realtime
 * INSERTs / UPDATEs filtered by `recipient_id`. When no user is present,
 * returns an empty list — callers don't need to branch.
 *
 * The red-dot badge on the profile popcorn uses `unreadCount > 0`.
 */
export function useNotifications(user: User | null): UseNotificationsResult {
  const [items, setItems] = useState<DBNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data ?? []) as DBNotification[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void refetch(); }, [refetch]);

  // Realtime — filter on recipient_id so each client only receives its own
  // rows (matches the RLS policy and keeps bandwidth tiny).
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notifications:recipient:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        () => { void refetch(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user?.id, refetch]);

  const markRead = useCallback(async (id: number) => {
    if (!user) return;
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n));
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .is("read_at", null);
  }, [user?.id]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    setItems(prev => prev.map(n => n.read_at ? n : { ...n, read_at: now }));
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("recipient_id", user.id)
      .is("read_at", null);
  }, [user?.id]);

  const unreadCount = useMemo(
    () => items.reduce((n, x) => n + (x.read_at ? 0 : 1), 0),
    [items],
  );

  return { items, unreadCount, loading, markRead, markAllRead };
}
