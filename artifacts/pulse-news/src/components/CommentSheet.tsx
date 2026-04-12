import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { X, ChevronUp, ChevronDown, ArrowUp } from "lucide-react";
import { GrainBackground } from "./GrainBackground";

type Sort = "popular" | "newest" | "oldest";

interface Reply {
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

interface Comment extends Reply {
  replies: Reply[];
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
const BRAND        = "#053980";                 // signature blue
const CREAM        = "#fff1cd";                 // inverted cream

// Avatar palette — quiet variations within the blue family
const AVATAR_BLUES = ["#053980", "#0c4a98", "#042a62", "#1d5aa6"];
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_BLUES[Math.abs(hash) % AVATAR_BLUES.length];
}

const YOU = { author: "You", initials: "Y", color: BRAND };

// ── Seed data ───────────────────────────────────────────────────────────────
const SEED_POOLS: Comment[][] = [
  [
    {
      id: 1, author: "Lena Park", initials: "LP", color: BRAND,
      text: "This is genuinely one of the more nuanced takes I've seen on this topic. The second paragraph alone changed how I'm thinking about it.",
      time: "1h ago", upvotes: 84, downvotes: 2, vote: null,
      replies: [
        { id: 11, author: "Tom Wills", initials: "TW", color: BRAND, text: "Completely agree — especially the bit about second-order effects.", time: "58m ago", upvotes: 14, downvotes: 0, vote: null },
        { id: 12, author: "Farah N.", initials: "FN", color: BRAND, text: "Which paragraph specifically? I read it differently.", time: "45m ago", upvotes: 6, downvotes: 1, vote: null },
      ],
    },
    {
      id: 2, author: "Tom Wills", initials: "TW", color: BRAND,
      text: "Paywall got me on the original article but this summary is solid. Anyone have a link to the full paper?",
      time: "2h ago", upvotes: 31, downvotes: 1, vote: null,
      replies: [],
    },
    {
      id: 3, author: "Farah N.", initials: "FN", color: BRAND,
      text: "The framing here is a bit misleading. The study had a sample size of 200 — hardly groundbreaking. Still interesting though.",
      time: "3h ago", upvotes: 56, downvotes: 14, vote: null,
      replies: [
        { id: 31, author: "Dev K.", initials: "DK", color: BRAND, text: "Sample size criticism is fair but the methodology is unusually rigorous for this field.", time: "2h ago", upvotes: 22, downvotes: 3, vote: null },
      ],
    },
    {
      id: 4, author: "Dev K.", initials: "DK", color: BRAND,
      text: "Saved. Will read properly tonight.",
      time: "3h ago", upvotes: 12, downvotes: 0, vote: null,
      replies: [],
    },
    {
      id: 5, author: "Simone B.", initials: "SB", color: BRAND,
      text: "I work in this space and the practical side is way more complicated than articles like this make out. That said — good starting point.",
      time: "5h ago", upvotes: 103, downvotes: 7, vote: null,
      replies: [
        { id: 51, author: "Raj M.", initials: "RM", color: BRAND, text: "Would love to hear more about the practical side — any resources you'd recommend?", time: "4h ago", upvotes: 31, downvotes: 0, vote: null },
        { id: 52, author: "Simone B.", initials: "SB", color: BRAND, text: "I'll put together a reading list — DM me.", time: "3h ago", upvotes: 18, downvotes: 0, vote: null },
      ],
    },
    {
      id: 6, author: "Iris T.", initials: "IT", color: BRAND,
      text: "The last line really lands. Thought-provoking stuff.",
      time: "8h ago", upvotes: 48, downvotes: 1, vote: null,
      replies: [],
    },
  ],
  [
    {
      id: 1, author: "Marcus O.", initials: "MO", color: BRAND,
      text: "Been following this story for months. The new angle here is interesting — didn't realise it had gone this far.",
      time: "45m ago", upvotes: 61, downvotes: 3, vote: null,
      replies: [
        { id: 11, author: "Priya S.", initials: "PS", color: BRAND, text: "Same. The timeline is wild when you map it out.", time: "30m ago", upvotes: 9, downvotes: 0, vote: null },
      ],
    },
    {
      id: 2, author: "Priya S.", initials: "PS", color: BRAND,
      text: "Every time I think I understand this fully, an article like this comes along.",
      time: "1h ago", upvotes: 38, downvotes: 0, vote: null,
      replies: [],
    },
    {
      id: 3, author: "Chris L.", initials: "CL", color: BRAND,
      text: "Hot take: the real story isn't what's reported but what's being left out. Read between the lines.",
      time: "2h ago", upvotes: 77, downvotes: 22, vote: null,
      replies: [
        { id: 31, author: "Anya V.", initials: "AV", color: BRAND, text: "What specifically do you think is being left out?", time: "1h ago", upvotes: 14, downvotes: 2, vote: null },
        { id: 32, author: "Chris L.", initials: "CL", color: BRAND, text: "The funding sources. Always follow the money.", time: "55m ago", upvotes: 29, downvotes: 5, vote: null },
      ],
    },
    {
      id: 4, author: "Kwame R.", initials: "KR", color: BRAND,
      text: "Good summary. Would love a deeper dive into the economic angle specifically.",
      time: "5h ago", upvotes: 44, downvotes: 2, vote: null,
      replies: [],
    },
    {
      id: 5, author: "Nadia F.", initials: "NF", color: BRAND,
      text: "Counterpoint: we've been hearing this for three years and nothing has materially changed. I'll believe it when I see it.",
      time: "7h ago", upvotes: 55, downvotes: 18, vote: null,
      replies: [],
    },
  ],
];

interface CommentSheetProps {
  isOpen: boolean;
  articleId: number;
  onClose: () => void;
}

export function getInitialCommentCount(articleId: number): number {
  const pool = SEED_POOLS[articleId % SEED_POOLS.length];
  return pool.reduce((n, c) => n + 1 + c.replies.length, 0);
}

let nextId = 1000;

const SORT_LABELS: Record<Sort, string> = {
  newest:  "Latest",
  oldest:  "Earliest",
  popular: "Popular",
};

export function CommentSheet({ isOpen, articleId, onClose }: CommentSheetProps) {
  const seed = SEED_POOLS[articleId % SEED_POOLS.length];
  const [comments, setComments] = useState<Comment[]>(seed.map(c => ({ ...c, replies: [...c.replies] })));
  const [sort, setSort] = useState<Sort>("popular");
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const [replyTo, setReplyTo] = useState<{ id: number; author: string } | null>(null);
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
    const fresh = SEED_POOLS[articleId % SEED_POOLS.length];
    setComments(fresh.map(c => ({ ...c, replies: [...c.replies] })));
    setExpandedReplies(new Set());
    setReplyTo(null);
    setInput("");
  }, [articleId]);

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
    if (replyTo && inputRef.current) inputRef.current.focus();
  }, [replyTo]);

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  const voteComment = (e: React.MouseEvent, id: number, dir: "up" | "down") => {
    e.stopPropagation();
    setComments(prev => prev.map(c => {
      if (c.id !== id) return c;
      const same = c.vote === dir;
      return {
        ...c,
        vote: same ? null : dir,
        upvotes:   dir === "up"   ? c.upvotes   + (same ? -1 : 1) : c.vote === "up"   ? c.upvotes   - 1 : c.upvotes,
        downvotes: dir === "down" ? c.downvotes + (same ? -1 : 1) : c.vote === "down" ? c.downvotes - 1 : c.downvotes,
      };
    }));
  };

  const voteReply = (e: React.MouseEvent, commentId: number, replyId: number, dir: "up" | "down") => {
    e.stopPropagation();
    setComments(prev => prev.map(c => {
      if (c.id !== commentId) return c;
      return {
        ...c,
        replies: c.replies.map(r => {
          if (r.id !== replyId) return r;
          const same = r.vote === dir;
          return {
            ...r,
            vote: same ? null : dir,
            upvotes:   dir === "up"   ? r.upvotes   + (same ? -1 : 1) : r.vote === "up"   ? r.upvotes   - 1 : r.upvotes,
            downvotes: dir === "down" ? r.downvotes + (same ? -1 : 1) : r.vote === "down" ? r.downvotes - 1 : r.downvotes,
          };
        }),
      };
    }));
  };

  const handleSend = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    const text = input.trim();
    if (!text) return;
    const freshId = ++nextId;

    if (replyTo) {
      // ── Reply ──────────────────────────────────────────────────────────
      setComments(prev => prev.map(c => {
        if (c.id !== replyTo.id) return c;
        return {
          ...c,
          replies: [...c.replies, { id: freshId, ...YOU, text, time: "just now", upvotes: 0, downvotes: 0, vote: null }],
        };
      }));
      setExpandedReplies(prev => new Set(prev).add(replyTo.id));
    } else {
      // ── New top-level comment ──────────────────────────────────────────
      setComments(prev => [
        { id: freshId, ...YOU, text, time: "just now", upvotes: 0, downvotes: 0, vote: null, replies: [] },
        ...prev,
      ]);
      // Switch to Latest so the user immediately sees their comment at the top
      setSort("newest");
      // Scroll the list to the top after React has painted the new entry
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    setInput("");
    setReplyTo(null);
    inputRef.current?.blur();

    // Highlight the new entry for 2 s then clear
    setNewCommentId(freshId);
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
    if (sort === "popular") return arr.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
    if (sort === "oldest")  return arr.reverse();
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
          background: "rgba(5,27,58,0.32)",
          backdropFilter: "blur(2px)",
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
          backdropFilter: "blur(26px) saturate(1.3)",
          WebkitBackdropFilter: "blur(26px) saturate(1.3)",
          borderRadius: "22px 22px 0 0",
          overflow: "hidden",
          transform: isOpen ? `translateY(${dragOffset}px)` : "translateY(100%)",
          transition: dragOffset > 0 ? "none" : "transform 0.34s cubic-bezier(0.32,0.72,0,1)",
          boxShadow: "0 -8px 40px rgba(5,27,58,0.22)",
        }}
        onClick={stopProp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Grain at reduced opacity so the backdrop-filter translucency shows through */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.22, pointerEvents: 'none' }}>
          <GrainBackground variant="paper" />
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
            return (
              <div
                key={c.id}
                className={c.id === newCommentId ? "cs-entry-new" : "cs-entry"}
                style={{ animationDelay: `${Math.min(idx, 6) * 50}ms` }}
              >
                <article style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 16, paddingBottom: 14 }}>
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
                          onUp={(e) => voteComment(e, c.id, "up")}
                          onDown={(e) => voteComment(e, c.id, "down")}
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
                      {c.replies.map((r, ri) => (
                        <div
                          key={r.id}
                          className="flex gap-2.5"
                          style={{
                            paddingTop:    ri > 0 ? 12 : 0,
                            paddingBottom: 12,
                            borderTop: ri > 0 ? `1px solid ${INK_HAIR}` : "none",
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
                            <div className="mt-2">
                              <VoteRow
                                upvotes={r.upvotes} downvotes={r.downvotes} vote={r.vote}
                                onUp={(e)   => voteReply(e, c.id, r.id, "up")}
                                onDown={(e) => voteReply(e, c.id, r.id, "down")}
                                small
                              />
                            </div>
                          </div>
                        </div>
                      ))}
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
