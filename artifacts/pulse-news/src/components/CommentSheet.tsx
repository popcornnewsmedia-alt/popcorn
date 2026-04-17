import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import { X, ChevronUp, ChevronDown, ArrowUp, MoreHorizontal, Trash2 } from "lucide-react";
import { GrainBackground } from "./GrainBackground";
import { useAuth } from "@/hooks/use-auth";
import { useComments } from "@/hooks/use-comments";
import { avatarColor, YOU, BRAND, CREAM } from "@/lib/avatar";

type Sort = "popular" | "newest" | "oldest";

// ── Swipe reveal palette ────────────────────────────────────────────────────
// Muted, editorial shades — aligned with the #051b3a / cream theme. Green
// leans sage (not neon), red leans brick (not alert). Both darken subtly
// past the commit threshold so the gesture feels physical.
const REPLY_GREEN = "47,106,78";     // r,g,b — sage
const DELETE_RED  = "168,59,46";     // r,g,b — brick

// Horizontal swipe mechanics. The commit threshold is where the gesture
// "latches" and committing beyond that just adds weight without extra
// travel — mirrors native iOS Mail / Messages row actions.
const SWIPE_COMMIT_PX   = 72;
const SWIPE_RESIST_FROM = 120;
const SWIPE_MAX_PX      = 180;

// Detect touch-primary devices once. Desktop users reach the same actions
// through the kebab menu, so wrapping every row in a gesture layer (with its
// own compositor layer + touch listeners) is wasted work there.
const IS_TOUCH_DEVICE = typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(hover: none) and (pointer: coarse)").matches;

type SwipeRowProps = {
  canDelete: boolean;
  onReply: () => void;
  onDelete: () => void;
  children: ReactNode;
};

// Public wrapper: short-circuits on desktop so we don't install a gesture
// layer (with its own compositor layer + touch listeners) for every row
// when users can't even swipe. Desktop reaches the same actions through
// the kebab menu.
function SwipeRow(props: SwipeRowProps) {
  if (!IS_TOUCH_DEVICE) return <>{props.children}</>;
  return <SwipeRowTouch {...props} />;
}

// ── SwipeRowTouch ──────────────────────────────────────────────────────────
// Wraps one comment or reply on touch devices. Tracks its own gesture state
// so rows don't fight each other. Locks to horizontal only once |dx|
// dominates |dy| (otherwise the sheet's drag-down-to-close gesture takes
// over cleanly).
function SwipeRowTouch({
  canDelete,
  onReply,
  onDelete,
  children,
}: SwipeRowProps) {
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const start = useRef<{ x: number; y: number; locked: boolean } | null>(null);
  const raf = useRef<number | null>(null);
  const pendingDx = useRef(0);

  const flushDx = useCallback(() => {
    raf.current = null;
    setDx(pendingDx.current);
  }, []);

  const scheduleDx = useCallback((next: number) => {
    pendingDx.current = next;
    if (raf.current == null) raf.current = requestAnimationFrame(flushDx);
  }, [flushDx]);

  useEffect(() => () => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
  }, []);

  const handleStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, locked: false };
    setAnimating(false);
  };

  const handleMove = (e: React.TouchEvent) => {
    const s = start.current;
    if (!s) return;
    const t = e.touches[0];
    const diffX = t.clientX - s.x;
    const diffY = t.clientY - s.y;
    if (!s.locked) {
      // Need enough motion to judge direction.
      if (Math.abs(diffX) < 6 && Math.abs(diffY) < 8) return;
      if (Math.abs(diffX) > Math.abs(diffY) + 2) {
        s.locked = true;
      } else {
        // Vertical gesture — release to the parent (drag-to-close / scroll).
        start.current = null;
        return;
      }
    }
    // Horizontal lock: stop the sheet's drag-to-close from seeing this,
    // and prevent the browser from also scrolling the page underneath.
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    let next = diffX;
    if (next < 0 && !canDelete) next = 0;
    // Resistance past the commit threshold — firm but not sticky.
    if (Math.abs(next) > SWIPE_RESIST_FROM) {
      const excess = Math.abs(next) - SWIPE_RESIST_FROM;
      next = Math.sign(next) * (SWIPE_RESIST_FROM + excess * 0.35);
    }
    if (Math.abs(next) > SWIPE_MAX_PX) next = Math.sign(next) * SWIPE_MAX_PX;
    scheduleDx(next);
  };

  const finish = useCallback((fire: (() => void) | null) => {
    if (raf.current != null) { cancelAnimationFrame(raf.current); raf.current = null; }
    pendingDx.current = 0;
    setAnimating(true);
    setDx(0);
    // Fire the action AFTER the spring-back starts so the row visually
    // returns before the modal/reply composer opens — feels less jumpy.
    if (fire) {
      window.setTimeout(fire, 140);
    }
    window.setTimeout(() => setAnimating(false), 280);
  }, []);

  const handleEnd = () => {
    const s = start.current;
    start.current = null;
    const currentDx = pendingDx.current || dx;
    if (!s || !s.locked) {
      if (currentDx !== 0) finish(null);
      return;
    }
    if (currentDx >= SWIPE_COMMIT_PX) {
      finish(onReply);
    } else if (currentDx <= -SWIPE_COMMIT_PX && canDelete) {
      finish(onDelete);
    } else {
      finish(null);
    }
  };

  const absDx = Math.abs(dx);
  const reveal = Math.min(1, absDx / SWIPE_RESIST_FROM);
  const past = absDx >= SWIPE_COMMIT_PX;

  return (
    <div
      style={{ position: "relative", overflow: "hidden", touchAction: "pan-y" }}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
    >
      {/* Reply reveal (right swipe) */}
      {dx > 0 && (
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center",
            paddingLeft: 22,
            background: `rgba(${REPLY_GREEN},${0.07 + reveal * 0.22})`,
            pointerEvents: "none",
          }}
        >
          <span style={{
            fontFamily: "'Macabro', 'Anton', sans-serif",
            fontSize: 11,
            letterSpacing: "0.20em",
            textTransform: "uppercase",
            color: past ? `rgba(${REPLY_GREEN},1)` : `rgba(${REPLY_GREEN},0.62)`,
            transform: `scale(${0.9 + reveal * 0.18}) translateX(${Math.min(12, reveal * 16)}px)`,
            transition: "color 0.14s ease, transform 0.14s ease",
            textShadow: past ? `0 0 0.4px rgba(${REPLY_GREEN},0.3)` : "none",
          }}>
            Reply
          </span>
        </div>
      )}
      {/* Delete reveal (left swipe, own rows only) */}
      {dx < 0 && canDelete && (
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            paddingRight: 22,
            background: `rgba(${DELETE_RED},${0.07 + reveal * 0.24})`,
            pointerEvents: "none",
          }}
        >
          <span style={{
            fontFamily: "'Macabro', 'Anton', sans-serif",
            fontSize: 11,
            letterSpacing: "0.20em",
            textTransform: "uppercase",
            color: past ? `rgba(${DELETE_RED},1)` : `rgba(${DELETE_RED},0.62)`,
            transform: `scale(${0.9 + reveal * 0.18}) translateX(${-Math.min(12, reveal * 16)}px)`,
            transition: "color 0.14s ease, transform 0.14s ease",
          }}>
            Delete
          </span>
        </div>
      )}
      {/* Foreground content */}
      <div
        style={{
          transform: `translateX(${dx}px)`,
          transition: animating ? "transform 0.26s cubic-bezier(0.22,1,0.36,1)" : "none",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── KebabMenu ──────────────────────────────────────────────────────────────
// Web-only (hidden on touch devices via `.cs-kebab { display:none }` under
// `@media (hover: none)`). Uppercase Macabro trigger + tight dropdown with
// one action — matches the editorial voice of the sheet rather than
// defaulting to a generic "⋯" drawer.
function KebabMenu({
  open, onToggle, onDelete, small = false,
}: {
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
  small?: boolean;
}) {
  return (
    <div
      className="cs-kebab"
      // Keep mousedown inside the menu from triggering the document-level
      // outside-click handler (which would race with click → onDelete).
      onMouseDown={(e) => e.stopPropagation()}
      style={{ position: "relative", marginLeft: "auto", display: "inline-flex", alignItems: "center" }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-label="Comment actions"
        className="cs-kebab-btn"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: small ? 22 : 24, height: small ? 22 : 24,
          borderRadius: 999,
          color: open ? "rgba(8,27,58,0.68)" : "rgba(8,27,58,0.40)",
          background: open ? "rgba(8,27,58,0.08)" : "transparent",
          transition: "background 0.14s ease, color 0.14s ease",
        }}
      >
        <MoreHorizontal size={small ? 13 : 14} strokeWidth={2.1} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 128,
            zIndex: 5,
            background: "rgba(253,247,229,0.98)",
            border: "1px solid rgba(8,27,58,0.10)",
            borderRadius: 10,
            padding: 4,
            boxShadow: "0 10px 30px rgba(5,27,58,0.18), 0 1px 0 rgba(8,27,58,0.05)",
            backdropFilter: "blur(10px) saturate(1.2)",
            WebkitBackdropFilter: "blur(10px) saturate(1.2)",
            animation: "csMenuIn 0.14s cubic-bezier(0.22,1,0.36,1) both",
          }}
        >
          <button
            role="menuitem"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="cs-menu-item cs-menu-item-danger"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%",
              padding: "8px 10px",
              borderRadius: 7,
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 600,
              fontSize: 12,
              letterSpacing: "0.01em",
              color: `rgba(${DELETE_RED},1)`,
              background: "transparent",
              textAlign: "left",
              cursor: "pointer",
              transition: "background 0.12s ease",
            }}
          >
            <Trash2 size={13} strokeWidth={2.1} />
            Delete comment
          </button>
        </div>
      )}
    </div>
  );
}

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
  const { comments, postComment, castVote, deleteComment } = useComments(articleId, user, profile?.username ?? null);
  const [sort, setSort] = useState<Sort>("popular");
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  // Delete confirmation: null when idle, else the target row's metadata.
  // `hasReplies` drives the copy addendum ("Replies will also be removed.")
  // because our DB cascades on parent_id.
  const [pendingDelete, setPendingDelete] = useState<
    { id: number; text: string; author: string; hasReplies: boolean }
    | null
  >(null);
  // Web-only kebab menu: holds the id of the row whose menu is open.
  // Hidden on touch devices via CSS media query (`@media (hover: none)`).
  const [kebabOpenId, setKebabOpenId] = useState<number | null>(null);
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
    setKebabOpenId(null);
    setPendingDelete(null);
  }, [articleId]);

  // Close the kebab menu on any outside interaction. Skip clicks inside a
  // `.cs-kebab` (button or menu) so mousedown doesn't race the click that
  // triggered onDelete. Kebab is desktop-only — no touchstart listener
  // needed (CSS hides it on touch devices).
  useEffect(() => {
    if (kebabOpenId === null) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest(".cs-kebab")) return;
      setKebabOpenId(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [kebabOpenId]);

  // ── Reply / Delete triggers (shared by swipe + manual buttons) ────────────
  const triggerReplyToComment = useCallback((id: number, author: string) => {
    if (!user) { onRequireAuth?.(); return; }
    setReplyTo({ id, author });
  }, [user, onRequireAuth]);

  const triggerReplyToReply = useCallback((
    parentId: number, replyAuthor: string, replyAuthorId: string,
  ) => {
    if (!user) { onRequireAuth?.(); return; }
    setReplyTo({ id: parentId, author: replyAuthor, mention: true, mentionUserId: replyAuthorId });
  }, [user, onRequireAuth]);

  const askDelete = useCallback((
    id: number, author: string, text: string, hasReplies: boolean,
  ) => {
    setKebabOpenId(null);
    setPendingDelete({ id, author, text, hasReplies });
  }, []);

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    // Close synchronously and fire the delete in the background.
    // `deleteComment` already removes the row optimistically and rolls
    // back on failure, so awaiting here just opens a hang window when
    // the Supabase request stalls on a flaky connection.
    setPendingDelete(null);
    void deleteComment(id);
  }, [pendingDelete, deleteComment]);

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
      // Strip a leading @ in case the author string already has one, to
      // avoid the '@@username' double-prefix bug.
      const prefix = `@${replyTo.author.replace(/^@/, "")} `;
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
        /* Kebab menu: web only — hide on touch-primary devices where the
           swipe gesture covers the same affordance. */
        @media (hover: none) and (pointer: coarse) {
          .cs-kebab { display: none !important; }
        }
        @media (hover: hover) {
          .cs-kebab-btn:hover { background: rgba(8,27,58,0.08); color: rgba(8,27,58,0.68); }
          .cs-menu-item:hover { background: rgba(8,27,58,0.06); }
          .cs-menu-item-danger:hover { background: rgba(168,59,46,0.10); }
          .cs-delete-keep:hover:not(:disabled) {
            background: rgba(255,241,205,0.06);
            border-color: rgba(255,241,205,0.35);
            color: #fff1cd;
          }
          .cs-delete-go:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 12px 28px rgba(255,241,205,0.24), 0 0 0 1px rgba(168,59,46,0.28) inset;
          }
        }
        .cs-delete-go:active:not(:disabled) { transform: translateY(0); }
        @keyframes csMenuIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes csModalIn {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes csBackdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
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
                <article>
                  <SwipeRow
                    canDelete={isOwn}
                    onReply={() => triggerReplyToComment(c.id, c.author)}
                    onDelete={() => askDelete(c.id, c.author, c.text, c.replies.length > 0)}
                  >
                    <div
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
                        {isOwn && (
                          <KebabMenu
                            open={kebabOpenId === c.id}
                            onToggle={() => setKebabOpenId(kebabOpenId === c.id ? null : c.id)}
                            onDelete={() => askDelete(c.id, c.author, c.text, c.replies.length > 0)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                    </div>
                  </SwipeRow>

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
                        <SwipeRow
                          key={r.id}
                          canDelete={isOwnReply}
                          onReply={() => triggerReplyToReply(c.id, r.author, r.authorId)}
                          onDelete={() => askDelete(r.id, r.author, r.text, false)}
                        >
                        <div
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
                              {isOwnReply && (
                                <KebabMenu
                                  small
                                  open={kebabOpenId === r.id}
                                  onToggle={() => setKebabOpenId(kebabOpenId === r.id ? null : r.id)}
                                  onDelete={() => askDelete(r.id, r.author, r.text, false)}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                        </SwipeRow>
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
                Reply to <span style={{ color: BRAND, fontWeight: 600 }}>@{replyTo.author.replace(/^@/, "")}</span>
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
                placeholder={replyTo ? `Reply to ${replyTo.author.replace(/^@/, "")}…` : "Add a comment…"}
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

      {/* ── Delete confirmation modal (brand palette) ─────────────────────── */}
      {/*    Dark blue body + cream type mirrors the feed; the destructive    */}
      {/*    signal lives only in the brick-red Delete word on the cream CTA, */}
      {/*    so the modal reads as a sibling of the app, not a system alert.  */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center"
          style={{
            padding: 20,
            // Backdrop uses the exact BRAND blue so the modal sits inside
            // the same colour family as the rest of the app.
            background: "rgba(5,57,128,0.62)",
            backdropFilter: "blur(8px) saturate(1.1)",
            WebkitBackdropFilter: "blur(8px) saturate(1.1)",
            animation: "csBackdropIn 0.22s ease-out both",
          }}
          onClick={(e) => { e.stopPropagation(); setPendingDelete(null); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cs-delete-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 300,
              // Layered radial in the top-left gives the flat brand blue a
              // touch of depth without introducing grain here (the sheet
              // behind already carries it). Base fill is exact BRAND.
              background: `radial-gradient(120% 90% at 0% 0%, rgba(255,241,205,0.08) 0%, rgba(255,241,205,0) 55%), ${BRAND}`,
              borderRadius: 16,
              padding: "18px 18px 14px",
              color: CREAM,
              boxShadow: "0 20px 52px rgba(0,0,0,0.42), 0 2px 0 rgba(255,241,205,0.06) inset",
              border: "1px solid rgba(255,241,205,0.12)",
              animation: "csModalIn 0.26s cubic-bezier(0.22,1,0.36,1) both",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Eyebrow row: small brick dot + tiny uppercase label. Cleaner
                than a full red top-bar and keeps the destructive cue
                subordinate to the headline. */}
            <div style={{
              display: "flex", alignItems: "center", gap: 7,
              marginBottom: 7,
            }}>
              <span aria-hidden style={{
                width: 5, height: 5, borderRadius: 999,
                background: `rgba(${DELETE_RED},1)`,
                boxShadow: `0 0 8px rgba(${DELETE_RED},0.6)`,
              }} />
              <span style={{
                fontFamily: "'Manrope', sans-serif",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                color: "rgba(255,241,205,0.58)",
              }}>
                Confirm deletion
              </span>
            </div>

            {/* Headline in Macabro — matches the voice of the sheet header */}
            <div
              id="cs-delete-title"
              style={{
                fontFamily: "'Macabro', 'Anton', sans-serif",
                fontSize: 22,
                lineHeight: 1.05,
                letterSpacing: "-0.005em",
                color: CREAM,
                marginBottom: 10,
              }}
            >
              Delete this {pendingDelete.hasReplies ? "thread" : "comment"}?
            </div>

            {/* Quoted preview — cream tint on the brand blue, with a cream
                left rule. Reads like a pulled-aside annotation. */}
            <div
              style={{
                position: "relative",
                background: "rgba(255,241,205,0.06)",
                border: "1px solid rgba(255,241,205,0.09)",
                borderRadius: 9,
                padding: "8px 10px 9px 12px",
                marginBottom: 11,
              }}
            >
              <span aria-hidden style={{
                position: "absolute", left: 0, top: 8, bottom: 8,
                width: 2, borderRadius: 2,
                background: "rgba(255,241,205,0.45)",
              }} />
              <span style={{
                fontFamily: "'Manrope', sans-serif",
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255,241,205,0.70)",
                display: "block",
                marginBottom: 3,
              }}>
                @{pendingDelete.author.replace(/^@/, "")}
              </span>
              <p style={{
                fontFamily: "'Manrope', sans-serif",
                fontSize: 12,
                lineHeight: 1.45,
                color: "rgba(255,241,205,0.88)",
                margin: 0,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {pendingDelete.text}
              </p>
            </div>

            <p style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: 11.5,
              lineHeight: 1.45,
              color: "rgba(255,241,205,0.58)",
              marginTop: 0,
              marginBottom: 13,
            }}>
              This can't be undone{pendingDelete.hasReplies ? ". Replies will also be removed." : "."}
            </p>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={(e) => { e.stopPropagation(); setPendingDelete(null); }}
                className="cs-delete-keep"
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: 600,
                  fontSize: 12,
                  letterSpacing: "0.02em",
                  color: "rgba(255,241,205,0.85)",
                  background: "transparent",
                  border: "1px solid rgba(255,241,205,0.22)",
                  cursor: "pointer",
                  transition: "background 0.14s ease, border-color 0.14s ease, color 0.14s ease",
                }}
              >
                Keep
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); confirmDelete(); }}
                className="cs-delete-go"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 14px",
                  borderRadius: 10,
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  // Brand CTA treatment: cream fill + BRAND base color…
                  color: BRAND,
                  background: CREAM,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: `0 6px 18px rgba(255,241,205,0.18), 0 0 0 1px rgba(${DELETE_RED},0.18) inset`,
                  transition: "transform 0.14s ease, box-shadow 0.14s ease, opacity 0.14s ease",
                }}
              >
                <Trash2 size={12} strokeWidth={2.4} color={`rgba(${DELETE_RED},1)`} />
                {/* …but the word itself carries the destructive hue. */}
                <span style={{ color: `rgba(${DELETE_RED},1)` }}>
                  Delete
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
