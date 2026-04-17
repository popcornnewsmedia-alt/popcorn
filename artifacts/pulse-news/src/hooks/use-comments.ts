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

function rowToReply(
  row: DBComment,
  myVote: number | undefined,
  liveUsername: string | undefined,
): Reply {
  // Prefer the current `@username` from the profiles table over whatever
  // was snapshotted into author_name at insert time. This guarantees that
  // display name changes never leak into the comment stream — the feed
  // only ever shows the authoritative handle — and that legacy rows
  // written before the username system are upgraded on the fly.
  const author = liveUsername ? `@${liveUsername}` : row.author_name;
  // Seed avatar color by author_id so it stays stable across name changes.
  return {
    id: row.id,
    author,
    authorId: row.author_id,
    initials: row.author_initials,
    color: avatarColor(row.author_id) || BRAND,
    text: row.body,
    time: formatRelative(row.created_at),
    upvotes: Number(row.upvotes) || 0,
    downvotes: Number(row.downvotes) || 0,
    vote: myVote === 1 ? "up" : myVote === -1 ? "down" : null,
  };
}

function buildTree(
  rows: DBComment[],
  voteMap: Map<number, number>,
  usernames: Map<string, string>,
): Comment[] {
  const tops: Comment[] = [];
  const byId = new Map<number, Comment>();
  for (const r of rows) {
    if (r.parent_id == null) {
      const c: Comment = {
        ...rowToReply(r, voteMap.get(r.id), usernames.get(r.author_id)),
        replies: [],
      };
      byId.set(r.id, c);
      tops.push(c);
    }
  }
  for (const r of rows) {
    if (r.parent_id != null) {
      const parent = byId.get(r.parent_id);
      if (parent) parent.replies.push(rowToReply(r, voteMap.get(r.id), usernames.get(r.author_id)));
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
  deleteComment: (commentId: number) => Promise<boolean>;
}

export function useComments(
  articleId: number | undefined | null,
  user: User | null,
  username: string | null = null,
): UseCommentsResult {
  const [rows, setRows] = useState<DBComment[]>([]);
  const [voteMap, setVoteMap] = useState<Map<number, number>>(new Map());
  // Live authorId -> @username lookup. Rendered over row.author_name so
  // comments always display the current username, not the snapshot taken
  // at insert time (which could be stale after a name change, or fall back
  // to full_name for pre-username rows).
  const [usernames, setUsernames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  // Ref mirrors voteMap so castVote can read the freshest direction
  // synchronously, even across rapid-fire clicks that would otherwise capture
  // a stale closure (e.g. double-tapping before React commits).
  const voteMapRef = useRef(voteMap);
  voteMapRef.current = voteMap;
  // Ref mirror so realtime INSERT handler (which lives outside the refetch
  // closure) can check whether an author's username is already cached.
  const usernamesRef = useRef(usernames);
  usernamesRef.current = usernames;
  // Ref mirror of rows for `deleteComment`'s rollback snapshot — lets the
  // callback capture rows-at-call-time without adding `rows` to its deps
  // (which would invalidate the callback on every realtime event).
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // Batch-load usernames for a set of author ids and merge into state.
  const hydrateUsernames = useCallback(async (authorIds: string[]) => {
    const need = Array.from(new Set(authorIds)).filter((id) => !usernamesRef.current.has(id));
    if (need.length === 0) return;
    const { data } = await supabase
      .from("profiles")
      .select("user_id,username")
      .in("user_id", need);
    if (!data || data.length === 0) return;
    setUsernames((prev) => {
      const next = new Map(prev);
      for (const row of data) {
        const uid = row.user_id as string;
        const uname = row.username as string | null;
        if (uname) next.set(uid, uname);
      }
      return next;
    });
  }, []);

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

    // Fire off a username hydration for every distinct author in one query.
    if (loaded.length > 0) {
      void hydrateUsernames(loaded.map((r) => r.author_id));
    }

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
  }, [articleId, user?.id, hydrateUsernames]);

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
          // Hydrate the new author's @username so the row renders with the
          // live handle instead of falling back to the snapshot.
          void hydrateUsernames([row.author_id]);
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
          // Skip re-allocating (and retriggering `buildTree`) when our
          // optimistic delete already removed this row client-side.
          setRows(prev => {
            const next = prev.filter(r => r.id !== oldRow.id);
            return next.length === prev.length ? prev : next;
          });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [articleId, hydrateUsernames]);

  // Safety net for mobile: realtime websockets frequently drop on iOS /
  // Android (background throttling, flaky cellular) and silently miss
  // INSERT events, so comments posted on another device never arrive.
  // Re-fetch whenever the tab becomes visible again or the network
  // reconnects, so a user coming back to the sheet always sees fresh state.
  useEffect(() => {
    if (articleId == null) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    const onOnline = () => { void refetch(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onVisible);
    };
  }, [articleId, refetch]);

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
    // Cache the poster's own @username so their own comment renders as
    // @handle immediately, even on the first comment they ever post.
    if (username) {
      setUsernames(prev => {
        if (prev.get(user.id) === username) return prev;
        const next = new Map(prev);
        next.set(user.id, username);
        return next;
      });
    }

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

  const deleteComment = useCallback(async (commentId: number): Promise<boolean> => {
    if (!user) return false;
    // Optimistically remove the row and any descendants from local state.
    // The DB has ON DELETE CASCADE on parent_id, so deleting a top-level
    // comment also removes its replies — mirror that client-side so the UI
    // doesn't briefly render orphan replies before the realtime fan-out.
    const snapshot = rowsRef.current;
    setRows(prev => prev.filter(r => r.id !== commentId && r.parent_id !== commentId));
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) {
      console.warn("[deleteComment] failed — reverting", error);
      setRows(snapshot);
      return false;
    }
    return true;
  }, [user?.id]);

  const comments = useMemo(() => buildTree(rows, voteMap, usernames), [rows, voteMap, usernames]);

  return { comments, loading, postComment, castVote, deleteComment };
}
