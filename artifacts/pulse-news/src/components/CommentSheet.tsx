import { useState, useRef, useEffect, useMemo } from "react";
import { X, ChevronUp, ChevronDown, SendHorizonal, CornerDownRight } from "lucide-react";
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

const YOU = { author: "You", initials: "Y", color: "#204a52" };

const SEED_POOLS: Comment[][] = [
  [
    {
      id: 1, author: "Lena Park", initials: "LP", color: "#2d6870",
      text: "This is genuinely one of the more nuanced takes I've seen on this topic. The second paragraph alone changed how I'm thinking about it.",
      time: "1h ago", upvotes: 84, downvotes: 2, vote: null,
      replies: [
        { id: 11, author: "Tom Wills", initials: "TW", color: "#1a3d45", text: "Completely agree — especially the bit about second-order effects.", time: "58m ago", upvotes: 14, downvotes: 0, vote: null },
        { id: 12, author: "Farah N.", initials: "FN", color: "#3d7a84", text: "Which paragraph specifically? I read it differently.", time: "45m ago", upvotes: 6, downvotes: 1, vote: null },
      ],
    },
    {
      id: 2, author: "Tom Wills", initials: "TW", color: "#1a3d45",
      text: "Paywall got me on the original article but this summary is solid. Anyone have a link to the full paper?",
      time: "2h ago", upvotes: 31, downvotes: 1, vote: null,
      replies: [],
    },
    {
      id: 3, author: "Farah N.", initials: "FN", color: "#3d7a84",
      text: "The framing here is a bit misleading. The study had a sample size of 200 — hardly groundbreaking. Still interesting though.",
      time: "3h ago", upvotes: 56, downvotes: 14, vote: null,
      replies: [
        { id: 31, author: "Dev K.", initials: "DK", color: "#154550", text: "Sample size criticism is fair but the methodology is unusually rigorous for this field.", time: "2h ago", upvotes: 22, downvotes: 3, vote: null },
      ],
    },
    {
      id: 4, author: "Dev K.", initials: "DK", color: "#154550",
      text: "Saved. Will read properly tonight.",
      time: "3h ago", upvotes: 12, downvotes: 0, vote: null,
      replies: [],
    },
    {
      id: 5, author: "Simone B.", initials: "SB", color: "#295e68",
      text: "I work in this space and the practical side is way more complicated than articles like this make out. That said — good starting point.",
      time: "5h ago", upvotes: 103, downvotes: 7, vote: null,
      replies: [
        { id: 51, author: "Raj M.", initials: "RM", color: "#2d6870", text: "Would love to hear more about the practical side — any resources you'd recommend?", time: "4h ago", upvotes: 31, downvotes: 0, vote: null },
        { id: 52, author: "Simone B.", initials: "SB", color: "#295e68", text: "I'll put together a reading list — DM me.", time: "3h ago", upvotes: 18, downvotes: 0, vote: null },
      ],
    },
    {
      id: 6, author: "Iris T.", initials: "IT", color: "#1a3d45",
      text: "The last line really lands. Thought-provoking stuff.",
      time: "8h ago", upvotes: 48, downvotes: 1, vote: null,
      replies: [],
    },
  ],
  [
    {
      id: 1, author: "Marcus O.", initials: "MO", color: "#3d7a84",
      text: "Been following this story for months. The new angle here is interesting — didn't realise it had gone this far.",
      time: "45m ago", upvotes: 61, downvotes: 3, vote: null,
      replies: [
        { id: 11, author: "Priya S.", initials: "PS", color: "#2d6870", text: "Same. The timeline is wild when you map it out.", time: "30m ago", upvotes: 9, downvotes: 0, vote: null },
      ],
    },
    {
      id: 2, author: "Priya S.", initials: "PS", color: "#2d6870",
      text: "Every time I think I understand this fully, an article like this comes along.",
      time: "1h ago", upvotes: 38, downvotes: 0, vote: null,
      replies: [],
    },
    {
      id: 3, author: "Chris L.", initials: "CL", color: "#154550",
      text: "Hot take: the real story isn't what's reported but what's being left out. Read between the lines.",
      time: "2h ago", upvotes: 77, downvotes: 22, vote: null,
      replies: [
        { id: 31, author: "Anya V.", initials: "AV", color: "#295e68", text: "What specifically do you think is being left out?", time: "1h ago", upvotes: 14, downvotes: 2, vote: null },
        { id: 32, author: "Chris L.", initials: "CL", color: "#154550", text: "The funding sources. Always follow the money.", time: "55m ago", upvotes: 29, downvotes: 5, vote: null },
      ],
    },
    {
      id: 4, author: "Kwame R.", initials: "KR", color: "#1a3d45",
      text: "Good summary. Would love a deeper dive into the economic angle specifically.",
      time: "5h ago", upvotes: 44, downvotes: 2, vote: null,
      replies: [],
    },
    {
      id: 5, author: "Nadia F.", initials: "NF", color: "#2d6870",
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

export function CommentSheet({ isOpen, articleId, onClose }: CommentSheetProps) {
  const seed = SEED_POOLS[articleId % SEED_POOLS.length];
  const [comments, setComments] = useState<Comment[]>(seed.map(c => ({ ...c, replies: [...c.replies] })));
  const [sort, setSort] = useState<Sort>("newest");
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const [replyTo, setReplyTo] = useState<{ id: number; author: string } | null>(null);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fresh = SEED_POOLS[articleId % SEED_POOLS.length];
    setComments(fresh.map(c => ({ ...c, replies: [...c.replies] })));
    setExpandedReplies(new Set());
    setReplyTo(null);
    setInput("");
  }, [articleId]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
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
        upvotes: dir === "up" ? c.upvotes + (same ? -1 : 1) : c.vote === "up" ? c.upvotes - 1 : c.upvotes,
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
            upvotes: dir === "up" ? r.upvotes + (same ? -1 : 1) : r.vote === "up" ? r.upvotes - 1 : r.upvotes,
            downvotes: dir === "down" ? r.downvotes + (same ? -1 : 1) : r.vote === "down" ? r.downvotes - 1 : r.downvotes,
          };
        }),
      };
    }));
  };

  const handleSend = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = input.trim();
    if (!text) return;
    if (replyTo) {
      setComments(prev => prev.map(c => {
        if (c.id !== replyTo.id) return c;
        return {
          ...c,
          replies: [...c.replies, { id: ++nextId, ...YOU, text, time: "just now", upvotes: 0, downvotes: 0, vote: null }],
        };
      }));
      setExpandedReplies(prev => new Set(prev).add(replyTo.id));
    } else {
      setComments(prev => [
        { id: ++nextId, ...YOU, text, time: "just now", upvotes: 0, downvotes: 0, vote: null, replies: [] },
        ...prev,
      ]);
    }
    setInput("");
    setReplyTo(null);
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
    if (sort === "oldest") return arr.reverse();
    return arr; // newest = default array order
  }, [comments, sort]);

  const totalCount = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  const VoteRow = ({ upvotes, downvotes, vote, onUp, onDown }: {
    upvotes: number; downvotes: number; vote: "up" | "down" | null;
    onUp: (e: React.MouseEvent) => void; onDown: (e: React.MouseEvent) => void;
  }) => (
    <div className="flex items-center gap-4 mt-2">
      <button onClick={onUp} className="flex items-center gap-1 active:scale-95 transition-transform">
        <ChevronUp className="w-4 h-4" style={{ color: vote === "up" ? '#204a52' : 'rgba(0,0,0,0.30)', strokeWidth: 2.5 }} />
        <span className="font-['Inter'] font-medium" style={{ fontSize: '12px', color: vote === "up" ? '#204a52' : 'rgba(0,0,0,0.40)' }}>{upvotes}</span>
      </button>
      <button onClick={onDown} className="flex items-center gap-1 active:scale-95 transition-transform">
        <ChevronDown className="w-4 h-4" style={{ color: vote === "down" ? '#204a52' : 'rgba(0,0,0,0.30)', strokeWidth: 2.5 }} />
        <span className="font-['Inter'] font-medium" style={{ fontSize: '12px', color: vote === "down" ? '#204a52' : 'rgba(0,0,0,0.40)' }}>{downvotes}</span>
      </button>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 transition-opacity duration-300"
        style={{ background: 'rgba(0,0,0,0.25)', opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none' }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
        style={{
          height: '82dvh',
          background: '#fbf8f2',
          borderRadius: '20px 20px 0 0',
          overflow: 'hidden',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1)',
        }}
        onClick={stopProp}
      >
        {/* Grain texture */}
        <GrainBackground variant="pale" />

        {/* Handle */}
        <div className="relative z-10 flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(32,74,82,0.35)' }} />
        </div>

        {/* Header */}
        <div className="relative z-10 flex-shrink-0" style={{ borderBottom: '1px solid rgba(32,74,82,0.20)' }}>
          <div className="flex items-center justify-between px-5 py-3">
            <div className="flex items-baseline gap-2">
              <span style={{ fontSize: '14px', color: '#204a52', fontFamily: "'Macabro', 'Anton', sans-serif", letterSpacing: '0.04em' }}>COMMENTS</span>
              <span className="font-['Inter']" style={{ fontSize: '13px', color: 'rgba(32,74,82,0.65)' }}>{totalCount}</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1 rounded-full transition-opacity hover:opacity-70">
              <X className="w-5 h-5" style={{ color: 'rgba(32,74,82,0.65)' }} />
            </button>
          </div>
          {/* Sort pills */}
          <div className="flex items-center gap-1.5 px-5 pb-3">
            {(["newest", "oldest", "popular"] as Sort[]).map(s => (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); setSort(s); }}
                className="px-3 py-1 rounded-full transition-all"
                style={{
                  fontFamily: "'Macabro', 'Anton', sans-serif",
                  fontSize: '10px',
                  letterSpacing: '0.06em',
                  background: sort === s ? '#204a52' : 'rgba(32,74,82,0.12)',
                  color: sort === s ? '#fff3d3' : 'rgba(32,74,82,0.70)',
                }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Comments list */}
        <div className="relative z-10 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {sortedComments.map((c, i) => {
            const repliesOpen = expandedReplies.has(c.id);
            return (
              <div key={c.id} style={{ borderBottom: i < sortedComments.length - 1 ? '1px solid rgba(0,0,0,0.07)' : 'none' }}>
                {/* Top-level comment */}
                <div className="flex gap-3 px-5 pt-4 pb-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: c.color }}>
                    <span className="font-['Inter'] font-bold text-white" style={{ fontSize: '11px' }}>{c.initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-['Inter'] font-semibold" style={{ fontSize: '13px', color: '#111111' }}>{c.author}</span>
                      <span className="font-['Inter']" style={{ fontSize: '11px', color: 'rgba(0,0,0,0.40)' }}>{c.time}</span>
                    </div>
                    <p className="font-['Inter'] leading-relaxed" style={{ fontSize: '14px', color: 'rgba(0,0,0,0.80)' }}>{c.text}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <VoteRow
                        upvotes={c.upvotes} downvotes={c.downvotes} vote={c.vote}
                        onUp={(e) => voteComment(e, c.id, "up")}
                        onDown={(e) => voteComment(e, c.id, "down")}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); setReplyTo({ id: c.id, author: c.author }); }}
                        className="font-['Inter'] font-semibold transition-opacity hover:opacity-70"
                        style={{ fontSize: '12px', color: 'rgba(0,0,0,0.40)', marginTop: '0.5rem' }}
                      >
                        Reply
                      </button>
                    </div>

                    {/* View replies toggle */}
                    {c.replies.length > 0 && (
                      <button
                        onClick={(e) => toggleReplies(e, c.id)}
                        className="flex items-center gap-1.5 mt-2 transition-opacity hover:opacity-70"
                      >
                        <CornerDownRight className="w-3.5 h-3.5" style={{ color: 'rgba(0,0,0,0.45)' }} />
                        <span className="font-['Inter'] font-semibold" style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)' }}>
                          {repliesOpen ? 'Hide' : `View`} {c.replies.length} {c.replies.length === 1 ? 'reply' : 'replies'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Replies */}
                {repliesOpen && c.replies.map((r) => (
                  <div key={r.id} className="flex gap-3 pl-14 pr-5 py-3" style={{ background: 'rgba(0,0,0,0.03)', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: r.color }}>
                      <span className="font-['Inter'] font-bold text-white" style={{ fontSize: '10px' }}>{r.initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-['Inter'] font-semibold" style={{ fontSize: '12px', color: '#111111' }}>{r.author}</span>
                        <span className="font-['Inter']" style={{ fontSize: '10px', color: 'rgba(0,0,0,0.40)' }}>{r.time}</span>
                      </div>
                      <p className="font-['Inter'] leading-relaxed" style={{ fontSize: '13px', color: 'rgba(0,0,0,0.75)' }}>{r.text}</p>
                      <VoteRow
                        upvotes={r.upvotes} downvotes={r.downvotes} vote={r.vote}
                        onUp={(e) => voteReply(e, c.id, r.id, "up")}
                        onDown={(e) => voteReply(e, c.id, r.id, "down")}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <div
          className="relative z-10 flex-shrink-0 px-4 py-3"
          style={{ borderTop: '1px solid rgba(0,0,0,0.08)', background: 'transparent' }}
        >
          {/* Reply target chip */}
          {replyTo && (
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="font-['Inter']" style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)' }}>
                Replying to <span style={{ color: '#204a52', fontWeight: 600 }}>@{replyTo.author}</span>
              </span>
              <button onClick={(e) => { e.stopPropagation(); setReplyTo(null); }} className="p-0.5">
                <X className="w-3.5 h-3.5" style={{ color: 'rgba(0,0,0,0.35)' }} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Your avatar */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: YOU.color }}>
              <span className="font-['Inter'] font-bold text-white" style={{ fontSize: '10px' }}>{YOU.initials}</span>
            </div>

            {/* Input */}
            <div
              className="flex-1 flex items-center rounded-full px-4 py-2"
              style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.10)' }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onClick={stopProp}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleSend(e as any); }}
                placeholder={replyTo ? `Reply to ${replyTo.author}…` : "Add a comment…"}
                className="flex-1 bg-transparent outline-none font-['Inter'] placeholder-[rgba(0,0,0,0.30)]"
                style={{ fontSize: '14px', color: '#111111' }}
              />
            </div>

            {/* Send */}
            <button
              onClick={handleSend}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity"
              style={{ background: input.trim() ? '#204a52' : 'rgba(32,74,82,0.15)', pointerEvents: input.trim() ? 'auto' : 'none' }}
            >
              <SendHorizonal className="w-4 h-4" style={{ color: input.trim() ? '#fff3d3' : 'rgba(0,0,0,0.25)' }} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
