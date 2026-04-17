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
  authorId: string;
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
    authorId: row.author_id,
    initials: row.author_initials,
    color: avatarColor(row.author_name) || BRAND,
    text: row.body,
    time: formatRelative(row.created_at),
    upvotes: Number(row.upvotes) || 0,
    downvotes: Number(row.downvotes) || 0,
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
  postComment: (body: string, parentId?: number | null, mentionUserId?: string | null) => Promise<number | null>;
  castVote: (commentId: number, direction: 1 | -1 | 0) => Promise<void>;
}

export function useComments(
  articleId: number | undefined | null,
  user: User | null,
  username: string | null = null,
): UseCommentsResult {
  const [rows, setRows] = useState<DBComment[]>([]);
  const [voteMap, setVoteMap] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);
  // Ref mirrors voteMap so castVote can read the freshest direction
  // synchronously, even across rapid-fire clicks that would otherwise capture
  // a stale closure (e.g. double-tapping before React commits).
  const voteMapRef = useRef(voteMap);
  voteMapRef.current = voteMap;

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
          // Supabase realtime sometimes delivers numeric columns as strings;
          // coerce so arithmetic in the UI stays correct.
          const coerced: DBComment = {
            ...row,
            upvotes: Number(row.upvotes) || 0,
            downvotes: Number(row.downvotes) || 0,
          };
          setRows(prev => prev.map(r => r.id === row.id ? { ...r, ...coerced } : r));
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

  const postComment = useCallback(async (
    body: string,
    parentId: number | null | undefined = null,
    mentionUserId: string | null | undefined = null,
  ): Promise<number | null> => {
    if (!user || articleId == null) return null;
    // Snapshot `@handle` into author_name when the user has picked a username;
    // old comments keep whatever string was recorded at insert time, so we
    // don't need a backfill.
    const { handle, initials } = deriveIdentity(user, username);
    const { data, error } = await supabase
      .from("comments")
      .insert({
        article_id: articleId,
        parent_id: parentId ?? null,
        author_id: user.id,
        author_name: handle,
        author_initials: initials,
        body,
      })
      .select("*")
      .single();
    if (error || !data) return null;
    const newRow = data as DBComment;
    // Optimistically append so the sender sees their entry instantly (realtime
    // re-fetch will reconcile, but we avoid the network round-trip delay).
    setRows(prev => prev.some(r => r.id === newRow.id) ? prev : [...prev, newRow]);

    // Reply-to-reply: the DB trigger only notifies the TOP-LEVEL parent's
    // author. If the user is replying to a sibling reply (via @mention),
    // explicitly notify that sibling's author too. Fire-and-forget — a
    // failure here shouldn't block the comment post.
    if (mentionUserId && mentionUserId !== user.id) {
      void supabase
        .rpc("notify_mention", { p_recipient_id: mentionUserId, p_reply_comment_id: newRow.id })
        .then(({ error: rpcError }) => {
          if (rpcError) console.warn("[notify_mention] failed", rpcError);
        });
    }
    return newRow.id;
  }, [articleId, user?.id, username]);

  const castVote = useCallback(async (commentId: number, direction: 1 | -1 | 0) => {
    if (!user) return;
    // Read the latest vote direction synchronously from the ref — the
    // closed-over `voteMap` can be stale across rapid-fire clicks that fire
    // before React commits the previous optimistic update.
    const prevDir = voteMapRef.current.get(commentId) ?? 0;

    // Optimistic local apply.
    setRows(prev => prev.map(r => {
      if (r.id !== commentId) return r;
      let up = Number(r.upvotes) || 0;
      let down = Number(r.downvotes) || 0;
      if (prevDir === 1) up = Math.max(0, up - 1);
      if (prevDir === -1) down = Math.max(0, down - 1);
      if (direction === 1) up++;
      if (direction === -1) down++;
      return { ...r, upvotes: up, downvotes: down };
    }));
    setVoteMap(prev => {
      const next = new Map(prev);
      if (direction === 0) next.delete(commentId); else next.set(commentId, direction);
      return next;
    });
    // Keep ref in step so another click within the same frame sees the
    // optimistic direction, not the pre-click value.
    const optimisticMap = new Map(voteMapRef.current);
    if (direction === 0) optimisticMap.delete(commentId); else optimisticMap.set(commentId, direction);
    voteMapRef.current = optimisticMap;

    const { data, error } = await supabase.rpc("cast_vote", {
      p_comment_id: commentId,
      p_direction: direction,
    });

    if (error) {
      console.warn("[cast_vote] RPC error — reverting optimistic vote", error);
      // Revert to the pre-click state (don't re-fetch: a failed RPC leaves
      // the DB untouched, so the authoritative post-click count is the
      // pre-click count. A re-fetch would do the same thing but introduces
      // a window where a concurrent realtime UPDATE could clobber it.)
      setRows(prev => prev.map(r => {
        if (r.id !== commentId) return r;
        let up = Number(r.upvotes) || 0;
        let down = Number(r.downvotes) || 0;
        // Undo the optimistic change
        if (direction === 1) up = Math.max(0, up - 1);
        if (direction === -1) down = Math.max(0, down - 1);
        // Restore the prev-click direction
        if (prevDir === 1) up++;
        if (prevDir === -1) down++;
        return { ...r, upvotes: up, downvotes: down };
      }));
      setVoteMap(prev => {
        const next = new Map(prev);
        if (prevDir === 0) next.delete(commentId); else next.set(commentId, prevDir);
        return next;
      });
      const revertedMap = new Map(voteMapRef.current);
      if (prevDir === 0) revertedMap.delete(commentId); else revertedMap.set(commentId, prevDir);
      voteMapRef.current = revertedMap;
      return;
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      // RPC succeeded but returned no row — leave optimistic state in place;
      // realtime UPDATE will reconcile.
      return;
    }

    const row = data[0] as { upvotes: number | string; downvotes: number | string; my_vote: number | string };
    const serverUp = Number(row.upvotes) || 0;
    const serverDown = Number(row.downvotes) || 0;
    const serverMyVote = Number(row.my_vote) || 0;

    setRows(prev => prev.map(r => r.id === commentId
      ? { ...r, upvotes: serverUp, downvotes: serverDown }
      : r));
    setVoteMap(prev => {
      const next = new Map(prev);
      if (!serverMyVote) next.delete(commentId); else next.set(commentId, serverMyVote);
      return next;
    });
    const serverMap = new Map(voteMapRef.current);
    if (!serverMyVote) serverMap.delete(commentId); else serverMap.set(commentId, serverMyVote);
    voteMapRef.current = serverMap;
  }, [user?.id]);

  const comments = useMemo(() => buildTree(rows, voteMap), [rows, voteMap]);

  return { comments, loading, postComment, castVote };
}
