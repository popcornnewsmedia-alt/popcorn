import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { X, ChevronUp, ChevronDown, ArrowUp } from "lucide-react";
import { GrainBackground } from "./GrainBackground";
import { useAuth } from "@/hooks/use-auth";
import { useComments } from "@/hooks/use-comments";
import { avatarColor, YOU, BRAND, CREAM } from "@/lib/avatar";

type Sort = "popular" | "newest" | "oldest";

// ── Theme ───────────────────────────────────────────────────────────────────
const INK          = "#081b3a";                 // primary text
const INK_BODY     = "rgba(8,27,58,0.78)";      // body text
const INK_ACTION   = "rgba(8,27,58,0.62)";      // vote counts, reply button
const INK_META     = "rgba(8,27,58,0.42)";      // secondary / meta
const INK_SORT     = "rgba(8,27,58,0.58)";      // inactive sort tabs
const INK_FAINT    = "rgba(8,27,58,0.36)";      // faint / inactive icons
const INK_HAIR     = "rgba(8,27,58,0.08)";      // hairlines
const INK_SOFT     = "rgba(8,27,58,0.04)";      // soft fills

interface CommentSheetProps {
  isOpen: boolean;
  articleId: number;
  onClose: () => void;
  // Deep-link target: scroll + expand replies for this comment when the sheet opens.
  focusCommentId?: number | null;
  // Called when an unauthenticated action is attempted (post/reply/vote).
  onRequireAuth?: () => void;
}

const SORT_LABELS: Record<Sort, string> = {
  newest:  "Latest",
  oldest:  "Earliest",
  popular: "Popular",
};

export function CommentSheet({ isOpen, articleId, onClose, focusCommentId, onRequireAuth }: CommentSheetProps) {
  const { user, profile } = useAuth();
  const { comments, postComment, castVote } = useComments(articleId, user, profile?.username ?? null);
  const [sort, setSort] = useState<Sort>("popular");
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  // `mention` is true when replying to another reply: the DB enforces two-level
  // threading so the new row becomes a sibling under the same top-level
  // parent, but we prefix `@author ` in the body so the context is preserved
  // visually in the flat thread. `mentionUserId` is the mentioned reply
  // author's Supabase user id, used to fire a second notification (the DB
  // trigger only notifies the top-level parent's author by default).
  const [replyTo, setReplyTo] = useState<
    { id: number; author: string; mention?: boolean; mentionUserId?: string }
    | null
  >(null);
  const [input, setInput] = useState("");
  const [newCommentId, setNewCommentId] = useState<number | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  // ── Drag-down-to-close ────────────────────────────────────────────────────
  const dragStartY = useRef<number | null>(null);
  const dragStartScrollTop = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only start drag tracking if list is scrolled to top (or not scrollable)
    const listEl = listRef.current;
    if (listEl && listEl.scrollTop > 4) return;
    dragStartY.current = e.touches[0].clientY;
    dragStartScrollTop.current = listEl?.scrollTop ?? 0;
    isDragging.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta <= 0) { setDragOffset(0); return; }
    // Only begin drag mode once pulled down enough to distinguish from scroll
    if (!isDragging.current && delta < 10) return;
    isDragging.current = true;
    // Dampen the drag with square-root resistance for natural feel
    const dampened = Math.sqrt(delta) * Math.sqrt(delta < 80 ? delta : 80);
    setDragOffset(Math.min(delta, dampened + delta * 0.18));
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragStartY.current === null) return;
    dragStartY.current = null;
    if (dragOffset > 80) {
      setDragOffset(0);
      onClose();
    } else {
      setDragOffset(0);
    }
    isDragging.current = false;
  }, [dragOffset, onClose]);

  useEffect(() => {
    setExpandedReplies(new Set());
    setReplyTo(null);
    setInput("");
  }, [articleId]);

  // Deep-link: expand replies + scroll to a specific comment when requested
  // (e.g. tapping a reply notification).
  useEffect(() => {
    if (!isOpen || !focusCommentId) return;
    if (!comments.some(c => c.id === focusCommentId)) return;
    setExpandedReplies(prev => new Set(prev).add(focusCommentId));
    setSort("newest");
    // Wait for React to paint, then scroll the target comment into view.
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-comment-id="${focusCommentId}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setNewCommentId(focusCommentId);
      setTimeout(() => setNewCommentId(null), 2200);
    }, 120);
    return () => clearTimeout(t);
  }, [isOpen, focusCommentId, comments.length]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.classList.add("pn-comments-open");
      if (listRef.current) listRef.current.scrollTop = 0;
    } else {
      document.body.style.overflow = "";
      document.body.classList.remove("pn-comments-open");
    }
    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("pn-comments-open");
    };
  }, [isOpen]);

  useEffect(() => {
    if (!replyTo) return;
    if (replyTo.mention) {
      const prefix = `@${replyTo.author} `;
      // Prefill only if the user hasn't started a different line of thought.
      setInput(prev => prev.trim().length === 0 ? prefix : prev);
    }
    inputRef.current?.focus();
  }, [replyTo]);

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  const findCurrentVote = useCallback((id: number): "up" | "down" | null => {
    for (const c of comments) {
      if (c.id === id) return c.vote;
      for (const r of c.replies) if (r.id === id) return r.vote;
    }
    return null;
  }, [comments]);

  const voteAny = (e: React.MouseEvent, id: number, dir: "up" | "down") => {
    e.stopPropagation();
    if (!user) { onRequireAuth?.(); return; }
    const current = findCurrentVote(id);
    // Toggle semantics identical to the old seed behaviour: same direction clears.
    const next: 1 | -1 | 0 = current === dir ? 0 : dir === "up" ? 1 : -1;
    void castVote(id, next);
  };

  const handleSend = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    const text = input.trim();
    if (!text) return;
    if (!user) { onRequireAuth?.(); return; }

    const targetReplyTo = replyTo;
    setInput("");
    setReplyTo(null);
    inputRef.current?.blur();

    const id = await postComment(
      text,
      targetReplyTo?.id ?? null,
      targetReplyTo?.mentionUserId ?? null,
    );
    if (id == null) return;

    if (targetReplyTo) {
      setExpandedReplies(prev => new Set(prev).add(targetReplyTo.id));
    } else {
      // Switch to Latest so the user immediately sees their comment at the top
      setSort("newest");
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    // Highlight the new entry for 2 s then clear
    setNewCommentId(id);
    setTimeout(() => setNewCommentId(null), 2000);
  };

  const toggleReplies = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setExpandedReplies(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const sortedComments = useMemo(() => {
    const arr = [...comments];
    // `buildTree` returns top-level comments ordered oldest-first (id asc),
    // so "newest" needs to reverse the array; "oldest" returns it as-is.
    if (sort === "popular") return arr.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
    if (sort === "newest")  return arr.reverse();
    return arr;
  }, [comments, sort]);

  const totalCount = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  // ── Tiny shared pieces ───────────────────────────────────────────────────
  const Avatar = ({ name, initials, size = 36 }: { name: string; initials: string; size?: number }) => (
    <div
      style={{
        width: size, height: size,
        borderRadius: "50%",
        background: avatarColor(name),
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span style={{
        fontFamily: "'Macabro', 'Anton', sans-serif",
        fontWeight: 700,
        fontSize: size <= 28 ? 10 : 13,
        color: CREAM,
        letterSpacing: "0.02em",
        lineHeight: 1,
      }}>
        {initials}
      </span>
    </div>
  );

  const VoteRow = ({ upvotes, downvotes, vote, onUp, onDown, small = false }: {
    upvotes: number; downvotes: number; vote: "up" | "down" | null;
    onUp: (e: React.MouseEvent) => void; onDown: (e: React.MouseEvent) => void;
    small?: boolean;
  }) => (
    <div className="flex items-center gap-3">
      <button onClick={onUp} className="flex items-center gap-1 active:scale-90 transition-transform">
        <ChevronUp style={{
          width: small ? 12.5 : 13.5, height: small ? 12.5 : 13.5,
          color: vote === "up" ? BRAND : INK_FAINT,
          strokeWidth: 2.2, transition: "color 0.15s",
        }} />
        <span style={{
          fontFamily: "'Manrope', sans-serif",
          fontWeight: 600,
          fontSize: small ? 10.5 : 11,
          color: vote === "up" ? BRAND : INK_ACTION,
          transition: "color 0.15s",
        }}>{upvotes}</span>
      </button>
      <button onClick={onDown} className="flex items-center gap-1 active:scale-90 transition-transform">
        <ChevronDown style={{
          width: small ? 12.5 : 13.5, height: small ? 12.5 : 13.5,
          color: vote === "down" ? "rgba(8,27,58,0.70)" : INK_FAINT,
          strokeWidth: 2.2, transition: "color 0.15s",
        }} />
        <span style={{
          fontFamily: "'Manrope', sans-serif",
          fontWeight: 600,
          fontSize: small ? 10.5 : 11,
          color: vote === "down" ? "rgba(8,27,58,0.70)" : INK_ACTION,
          transition: "color 0.15s",
        }}>{downvotes}</span>
      </button>
    </div>
  );

  return (
    <>
      {/* ── local animations ─────────────────────────────────────────────── */}
      <style>{`
        @keyframes csFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes csHighlight {
          0%   { background: rgba(5,57,128,0.07); }
          100% { background: transparent; }
        }
        .cs-entry { animation: csFadeIn 0.36s cubic-bezier(0.22,1,0.36,1) both; }
        .cs-entry-new { animation: csFadeIn 0.36s cubic-bezier(0.22,1,0.36,1) both, csHighlight 2s ease-out 0.1s forwards; }
        .cs-list::-webkit-scrollbar { display: none; }
        .cs-input::placeholder { color: rgba(8,27,58,0.32); }
        body.pn-comments-open .pn-bottom-nav {
          opacity: 0;
          pointer-events: none !important;
          transform: translateY(30px);
        }
        body.pn-comments-open .pn-bottom-nav * {
          pointer-events: none !important;
        }
      `}</style>

      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-[60] transition-opacity duration-300"
        style={{
          background: isOpen ? "rgba(5,27,58,0.32)" : "transparent",
          backdropFilter: isOpen ? "blur(2px)" : "none",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
        }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />

      {/* ── Sheet ───────────────────────────────────────────────────────── */}
      <div
        className="fixed inset-x-0 bottom-0 z-[60] flex flex-col"
        style={{
          height: "82dvh",
          background: "rgba(253,247,229,0.73)",
          backdropFilter: isOpen ? "blur(26px) saturate(1.3)" : "none",
          WebkitBackdropFilter: isOpen ? "blur(26px) saturate(1.3)" : "none",
          borderRadius: "22px 22px 0 0",
          overflow: "hidden",
          transform: isOpen ? `translateY(${dragOffset}px)` : "translateY(100%)",
          transition: dragOffset > 0 ? "none" : "transform 0.34s cubic-bezier(0.32,0.72,0,1)",
          // Only paint the upward shadow when open — otherwise it bleeds into
          // the bottom of the viewport (even though the sheet is translated
          // off-screen), stacking with every other closed sheet and producing
          // a purple/pink fringing band on every page.
          boxShadow: isOpen ? "0 -8px 40px rgba(5,27,58,0.22)" : "none",
        }}
        onClick={stopProp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Grain at reduced opacity so the backdrop-filter translucency shows through */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.22, pointerEvents: 'none' }}>
          {isOpen && <GrainBackground variant="paper" />}
        </div>

        {/* Handle */}
        <div className="relative z-10 flex justify-center pt-2.5 pb-2 flex-shrink-0">
          <div className="rounded-full" style={{ width: 36, height: 3.5, background: "rgba(8,27,58,0.16)" }} />
        </div>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="relative z-10 flex-shrink-0 px-5 pt-0.5 pb-3">
          {/* Top micro-row: discreet brand count + close */}
          <div className="flex items-center justify-between mb-3">
            <span style={{
              fontFamily: "'Macabro', 'Anton', sans-serif",
              fontSize: 8.5,
              color: INK_ACTION,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              lineHeight: 1,
            }}>
              {totalCount} Comments
            </span>

            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="flex items-center justify-center active:opacity-50 transition-opacity"
              style={{
                width: 24, height: 24,
                borderRadius: "50%",
                background: INK_SOFT,
              }}
              aria-label="Close"
            >
              <X style={{ width: 10.5, height: 10.5, color: "rgba(8,27,58,0.55)", strokeWidth: 2.2 }} />
            </button>
          </div>

          {/* Sort tabs — Macabro, underline highlight */}
          <div className="flex items-center gap-5">
            {(["popular", "newest", "oldest"] as Sort[]).map(s => {
              const active = sort === s;
              return (
                <button
                  key={s}
                  onClick={(e) => { e.stopPropagation(); setSort(s); }}
                  className="relative transition-colors duration-150"
                  style={{
                    fontFamily: "'Macabro', 'Anton', sans-serif",
                    fontSize: 10.5,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: active ? BRAND : INK_SORT,
                    padding: "3px 0 5px",
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {SORT_LABELS[s]}
                  {active && (
                    <span style={{
                      position: "absolute",
                      bottom: 0, left: 0, right: 0,
                      height: 1.5,
                      background: BRAND,
                      borderRadius: 2,
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hairline under header */}
        <div className="relative z-10 flex-shrink-0" style={{ marginInline: 20, height: 1, background: INK_HAIR }} />

        {/* ── Comments list ─────────────────────────────────────────────── */}
        <div
          ref={listRef}
          className="cs-list relative z-10 flex-1 overflow-y-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {sortedComments.map((c, idx) => {
            const repliesOpen = expandedReplies.has(c.id);
            const isOwn = !!user && c.authorId === user.id;
            return (
              <div
                key={c.id}
                data-comment-id={c.id}
                className={c.id === newCommentId ? "cs-entry-new" : "cs-entry"}
                style={{ animationDelay: `${Math.min(idx, 6) * 50}ms` }}
              >
                <article
                  style={{
                    paddingLeft: 20,
                    paddingRight: 20,
                    paddingTop: 16,
                    paddingBottom: 14,
                    // Own-comment highlight — editorial annotation rather than UI chrome.
                    // A soft tint + inset left rule in the brand ink quietly marks
                    // the current user's posts without breaking the thread rhythm.
                    background: isOwn ? "rgba(5,57,128,0.045)" : undefined,
                    boxShadow: isOwn ? "inset 2px 0 0 rgba(5,57,128,0.38)" : undefined,
                  }}
                >
                  <div className="flex gap-3">
                    <Avatar name={c.author} initials={c.initials} size={34} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1" style={{ flexWrap: "wrap" }}>
                        <span style={{
                          fontFamily: "'Macabro', 'Anton', sans-serif",
                          fontSize: 11,
                          color: BRAND,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}>
                          {c.author}
                        </span>
                        {isOwn && (
                          <span
                            aria-label="your comment"
                            style={{
                              fontFamily: "'Macabro', 'Anton', sans-serif",
                              fontSize: 9,
                              color: BRAND,
                              letterSpacing: "0.12em",
                              textTransform: "uppercase",
                              padding: "1px 5px",
                              borderRadius: 3,
                              background: "rgba(5,57,128,0.10)",
                              lineHeight: 1.1,
                              alignSelf: "center",
                            }}
                          >
                            You
                          </span>
                        )}
                        <span style={{
                          fontFamily: "'Manrope', sans-serif",
                          fontWeight: 400,
                          fontSize: 10.5,
                          color: INK_META,
                        }}>
                          {c.time}
                        </span>
                      </div>

                      <p style={{
                        fontFamily: "'Manrope', sans-serif",
                        fontWeight: 400,
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: INK_BODY,
                        letterSpacing: "-0.005em",
                      }}>
                        {c.text}
                      </p>

                      <div className="flex items-center gap-4 mt-2.5">
                        <VoteRow
                          upvotes={c.upvotes} downvotes={c.downvotes} vote={c.vote}
                          onUp={(e) => voteAny(e, c.id, "up")}
                          onDown={(e) => voteAny(e, c.id, "down")}
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); setReplyTo({ id: c.id, author: c.author }); }}
                          className="active:opacity-50 transition-opacity"
                          style={{
                            fontFamily: "'Manrope', sans-serif",
                            fontWeight: 600,
                            fontSize: 11,
                            color: INK_ACTION,
                          }}
                        >
                          Reply
                        </button>
                        {c.replies.length > 0 && (
                          <button
                            onClick={(e) => toggleReplies(e, c.id)}
                            className="active:opacity-50 transition-opacity"
                            style={{
                              fontFamily: "'Manrope', sans-serif",
                              fontWeight: 600,
                              fontSize: 11,
                              color: INK_ACTION,
                            }}
                          >
                            {repliesOpen
                              ? "Hide"
                              : `${c.replies.length} ${c.replies.length === 1 ? "reply" : "replies"}`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Replies */}
                  {repliesOpen && c.replies.length > 0 && (
                    <div
                      className="mt-4"
                      style={{
                        marginLeft: 48,
                        marginRight: 4,
                        paddingLeft: 14,
                        borderLeft: `1px solid ${INK_HAIR}`,
                      }}
                    >
                      {c.replies.map((r, ri) => {
                        const isOwnReply = !!user && r.authorId === user.id;
                        return (
                        <div
                          key={r.id}
                          className="flex gap-2.5"
                          style={{
                            paddingTop:    ri > 0 ? 12 : 0,
                            paddingBottom: 12,
                            borderTop: ri > 0 ? `1px solid ${INK_HAIR}` : "none",
                            // Scaled-down own-reply highlight: negative margin
                            // to overshoot the reply gutter's inset so the tint
                            // reaches the left rule cleanly, then padding to
                            // restore the content position.
                            background: isOwnReply ? "rgba(5,57,128,0.045)" : undefined,
                            boxShadow: isOwnReply ? "inset 2px 0 0 rgba(5,57,128,0.38)" : undefined,
                            marginLeft: isOwnReply ? -14 : undefined,
                            paddingLeft: isOwnReply ? 12 : undefined,
                            marginRight: isOwnReply ? -4 : undefined,
                            paddingRight: isOwnReply ? 4 : undefined,
                          }}
                        >
                          <Avatar name={r.author} initials={r.initials} size={26} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-1" style={{ flexWrap: "wrap" }}>
                              <span style={{
                                fontFamily: "'Macabro', 'Anton', sans-serif",
                                fontSize: 10,
                                color: BRAND,
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                              }}>
                                {r.author}
                              </span>
                              {isOwnReply && (
                                <span
                                  aria-label="your reply"
                                  style={{
                                    fontFamily: "'Macabro', 'Anton', sans-serif",
                                    fontSize: 8.5,
                                    color: BRAND,
                                    letterSpacing: "0.12em",
                                    textTransform: "uppercase",
                                    padding: "1px 4px",
                                    borderRadius: 3,
                                    background: "rgba(5,57,128,0.10)",
                                    lineHeight: 1.1,
                                    alignSelf: "center",
                                  }}
                                >
                                  You
                                </span>
                              )}
                              <span style={{
                                fontFamily: "'Manrope', sans-serif",
                                fontWeight: 400,
                                fontSize: 10,
                                color: INK_META,
                              }}>
                                {r.time}
                              </span>
                            </div>
                            <p style={{
                              fontFamily: "'Manrope', sans-serif",
                              fontWeight: 400,
                              fontSize: 12.5,
                              lineHeight: 1.55,
                              color: INK_BODY,
                              letterSpacing: "-0.005em",
                            }}>
                              {r.text}
                            </p>
                            <div className="flex items-center gap-4 mt-2">
                              <VoteRow
                                upvotes={r.upvotes} downvotes={r.downvotes} vote={r.vote}
                                onUp={(e)   => voteAny(e, r.id, "up")}
                                onDown={(e) => voteAny(e, r.id, "down")}
                                small
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // DB trigger enforces two-level threading,
                                  // so a reply-to-reply is stored as a sibling
                                  // under the same top-level parent (c.id) but
                                  // surfaced with an @mention of the reply's
                                  // author in the composer preview.
                                  // `mentionUserId` lets postComment fire a
                                  // notification to the reply's author (the DB
                                  // trigger only notifies c.author).
                                  setReplyTo({
                                    id: c.id,
                                    author: r.author,
                                    mention: true,
                                    mentionUserId: r.authorId,
                                  });
                                }}
                                className="active:opacity-50 transition-opacity"
                                style={{
                                  fontFamily: "'Manrope', sans-serif",
                                  fontWeight: 600,
                                  fontSize: 10.5,
                                  color: INK_ACTION,
                                }}
                              >
                                Reply
                              </button>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </article>

                {/* Hairline between comments */}
                {idx < sortedComments.length - 1 && (
                  <div style={{ marginInline: 20, height: 1, background: INK_HAIR }} />
                )}
              </div>
            );
          })}
          <div style={{ height: 20 }} />
        </div>

        {/* ── Composer ──────────────────────────────────────────────────── */}
        <div
          ref={composerRef}
          className="relative z-10 flex-shrink-0 px-4 pt-3"
          style={{
            paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
            borderTop: `1px solid ${inputFocused ? "rgba(5,57,128,0.18)" : INK_HAIR}`,
            transition: "border-color 0.2s",
          }}
        >
          {replyTo && (
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span style={{
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 500,
                fontSize: 11.5,
                color: INK_META,
              }}>
                Reply to <span style={{ color: BRAND, fontWeight: 600 }}>@{replyTo.author}</span>
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setReplyTo(null); }}
                className="p-0.5 active:opacity-50"
              >
                <X style={{ width: 12, height: 12, color: "rgba(8,27,58,0.45)" }} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2.5">
            <Avatar name={YOU.author} initials={YOU.initials} size={34} />

            <div
              className="flex-1 flex items-center px-4"
              style={{
                height: 40,
                borderRadius: 999,
                background: inputFocused ? "rgba(8,27,58,0.06)" : INK_SOFT,
                border: `1px solid ${inputFocused ? "rgba(5,57,128,0.22)" : INK_HAIR}`,
                transition: "background 0.18s, border-color 0.18s",
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onClick={stopProp}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") handleSend(e as any); }}
                placeholder={replyTo ? `Reply to ${replyTo.author}…` : "Add a comment…"}
                className="cs-input flex-1 bg-transparent outline-none"
                inputMode="text"
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="on"
                spellCheck
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: 13.5,
                  color: INK,
                }}
              />
            </div>

            <button
              onClick={handleSend}
              className="flex items-center justify-center flex-shrink-0 active:scale-90"
              style={{
                width: 38, height: 38,
                borderRadius: "50%",
                background: input.trim() ? BRAND : INK_SOFT,
                transition: "all 0.18s cubic-bezier(0.34,1.56,0.64,1)",
                pointerEvents: input.trim() ? "auto" : "none",
              }}
              aria-label="Send"
            >
              <ArrowUp style={{
                width: 16, height: 16,
                color: input.trim() ? CREAM : "rgba(8,27,58,0.35)",
                strokeWidth: 2.4,
              }} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
