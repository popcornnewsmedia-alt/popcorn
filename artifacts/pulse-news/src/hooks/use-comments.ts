import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { DBComment } from "@/lib/comments-types";
import { avatarColor, BRAND } from "@/lib/avatar";
import { deriveIdentity, formatRelative } from "@/lib/identity";

// View-layer shapes — kept identical to the seed-data interfaces the sheet
// already renders so the JSX doesn't have to change.
export interface Reply {
  id: number;
  author: string;
  initials: string;
  color: string;
  text: string;
  time: string;
  upvotes: number;
  downvotes: number;
  vote: "up" | "down" | null;
}

export interface Comment extends Reply {
  replies: Reply[];
}

function rowToReply(row: DBComment, myVote: number | undefined): Reply {
  return {
    id: row.id,
    author: row.author_name,
    initials: row.author_initials,
    color: avatarColor(row.author_name) || BRAND,
    text: row.body,
    time: formatRelative(row.created_at),
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    vote: myVote === 1 ? "up" : myVote === -1 ? "down" : null,
  };
}

function buildTree(rows: DBComment[], voteMap: Map<number, number>): Comment[] {
  const tops: Comment[] = [];
  const byId = new Map<number, Comment>();
  for (const r of rows) {
    if (r.parent_id == null) {
      const c: Comment = { ...rowToReply(r, voteMap.get(r.id)), replies: [] };
      byId.set(r.id, c);
      tops.push(c);
    }
  }
  for (const r of rows) {
    if (r.parent_id != null) {
      const parent = byId.get(r.parent_id);
      if (parent) parent.replies.push(rowToReply(r, voteMap.get(r.id)));
    }
  }
  // Deterministic ordering inside replies (oldest first within a thread).
  for (const c of tops) c.replies.sort((a, b) => a.id - b.id);
  // Top-level ordered oldest-first; CommentSheet applies its own sort.
  tops.sort((a, b) => a.id - b.id);
  return tops;
}

interface UseCommentsResult {
  comments: Comment[];
  loading: boolean;
  postComment: (body: string, parentId?: number | null) => Promise<number | null>;
  castVote: (commentId: number, direction: 1 | -1 | 0) => Promise<void>;
}

export function useComments(articleId: number | undefined | null, user: User | null): UseCommentsResult {
  const [rows, setRows] = useState<DBComment[]>([]);
  const [voteMap, setVoteMap] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const refetch = useCallback(async () => {
    if (articleId == null) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data: commentRows } = await supabase
      .from("comments")
      .select("*")
      .eq("article_id", articleId)
      .order("created_at", { ascending: true });
    const loaded = (commentRows ?? []) as DBComment[];
    setRows(loaded);

    if (user && loaded.length > 0) {
      const ids = loaded.map(r => r.id);
      const { data: voteRows } = await supabase
        .from("comment_votes")
        .select("comment_id,direction")
        .in("comment_id", ids);
      const m = new Map<number, number>();
      for (const v of voteRows ?? []) m.set(v.comment_id as number, v.direction as number);
      setVoteMap(m);
    } else {
      setVoteMap(new Map());
    }
    setLoading(false);
  }, [articleId, user?.id]);

  useEffect(() => { refetch(); }, [refetch]);

  // Realtime: apply row-level INSERT/UPDATE/DELETE directly to local state.
  // A full refetch() would race with the optimistic vote update (the refetch
  // fetches `comment_votes` separately, and the server round-trip can easily
  // land in between the RPC reply and the realtime UPDATE — briefly wiping
  // the newly-applied vote back to stale values).
  useEffect(() => {
    if (articleId == null) return;
    const ch = supabase
      .channel(`comments:article:${articleId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `article_id=eq.${articleId}` },
        (payload) => {
          const row = payload.new as DBComment;
          setRows(prev => prev.some(r => r.id === row.id) ? prev : [...prev, row]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "comments", filter: `article_id=eq.${articleId}` },
        (payload) => {
          const row = payload.new as DBComment;
          setRows(prev => prev.map(r => r.id === row.id
            // Preserve counts that are >= the broadcast row's counts. In
            // practice the broadcast carries the authoritative post-UPDATE
            // values, so this just merges without fighting optimistic local
            // state on the rare occasion the realtime event arrives later.
            ? { ...r, ...row }
            : r));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "comments", filter: `article_id=eq.${articleId}` },
        (payload) => {
          const oldRow = payload.old as DBComment;
          setRows(prev => prev.filter(r => r.id !== oldRow.id));
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [articleId]);

  const postComment = useCallback(async (body: string, parentId: number | null | undefined = null): Promise<number | null> => {
    if (!user || articleId == null) return null;
    const { name, initials } = deriveIdentity(user);
    const { data, error } = await supabase
      .from("comments")
      .insert({
        article_id: articleId,
        parent_id: parentId ?? null,
        author_id: user.id,
        author_name: name,
        author_initials: initials,
        body,
      })
      .select("*")
      .single();
    if (error || !data) return null;
    // Optimistically append so the sender sees their entry instantly (realtime
    // re-fetch will reconcile, but we avoid the network round-trip delay).
    setRows(prev => prev.some(r => r.id === (data as DBComment).id)
      ? prev
      : [...prev, data as DBComment]);
    return (data as DBComment).id;
  }, [articleId, user?.id]);

  const castVote = useCallback(async (commentId: number, direction: 1 | -1 | 0) => {
    if (!user) return;
    // Optimistic local apply — re-apply whatever the server returns.
    const prevDir = voteMap.get(commentId) ?? 0;
    setRows(prev => prev.map(r => {
      if (r.id !== commentId) return r;
      let up = r.upvotes, down = r.downvotes;
      if (prevDir === 1) up--;
      if (prevDir === -1) down--;
      if (direction === 1) up++;
      if (direction === -1) down++;
      return { ...r, upvotes: up, downvotes: down };
    }));
    setVoteMap(prev => {
      const next = new Map(prev);
      if (direction === 0) next.delete(commentId); else next.set(commentId, direction);
      return next;
    });
    const { data, error } = await supabase.rpc("cast_vote", { p_comment_id: commentId, p_direction: direction });
    if (error || !data || !Array.isArray(data) || data.length === 0) {
      // On failure, re-sync from server.
      void (async () => {
        const { data: fresh } = await supabase.from("comments").select("*").eq("id", commentId).single();
        if (fresh) setRows(prev => prev.map(r => r.id === commentId ? (fresh as DBComment) : r));
      })();
      return;
    }
    const row = data[0] as { upvotes: number; downvotes: number; my_vote: number };
    setRows(prev => prev.map(r => r.id === commentId ? { ...r, upvotes: row.upvotes, downvotes: row.downvotes } : r));
    setVoteMap(prev => {
      const next = new Map(prev);
      if (!row.my_vote) next.delete(commentId); else next.set(commentId, row.my_vote);
      return next;
    });
  }, [user?.id, voteMap]);

  const comments = useMemo(() => buildTree(rows, voteMap), [rows, voteMap]);

  return { comments, loading, postComment, castVote };
}
