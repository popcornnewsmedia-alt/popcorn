import { useState, useRef, useEffect } from "react";
import { X, ChevronUp, ChevronDown, SendHorizonal, CornerDownRight } from "lucide-react";

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

const YOU = { author: "You", initials: "Y", color: "#1a1a2e" };

const SEED_POOLS: Comment[][] = [
  [
    {
      id: 1, author: "Lena Park", initials: "LP", color: "#2d6a4f",
      text: "This is genuinely one of the more nuanced takes I've seen on this topic. The second paragraph alone changed how I'm thinking about it.",
      time: "1h ago", upvotes: 84, downvotes: 2, vote: null,
      replies: [
        { id: 11, author: "Tom Wills", initials: "TW", color: "#1b4332", text: "Completely agree — especially the bit about second-order effects.", time: "58m ago", upvotes: 14, downvotes: 0, vote: null },
        { id: 12, author: "Farah N.", initials: "FN", color: "#40916c", text: "Which paragraph specifically? I read it differently.", time: "45m ago", upvotes: 6, downvotes: 1, vote: null },
      ],
    },
    {
      id: 2, author: "Tom Wills", initials: "TW", color: "#1b4332",
      text: "Paywall got me on the original article but this summary is solid. Anyone have a link to the full paper?",
      time: "2h ago", upvotes: 31, downvotes: 1, vote: null,
      replies: [],
    },
    {
      id: 3, author: "Farah N.", initials: "FN", color: "#40916c",
      text: "The framing here is a bit misleading. The study had a sample size of 200 — hardly groundbreaking. Still interesting though.",
      time: "3h ago", upvotes: 56, downvotes: 14, vote: null,
      replies: [
        { id: 31, author: "Dev K.", initials: "DK", color: "#1a3c34", text: "Sample size criticism is fair but the methodology is unusually rigorous for this field.", time: "2h ago", upvotes: 22, downvotes: 3, vote: null },
      ],
    },
    {
      id: 4, author: "Dev K.", initials: "DK", color: "#1a3c34",
      text: "Saved. Will read properly tonight.",
      time: "3h ago", upvotes: 12, downvotes: 0, vote: null,
      replies: [],
    },
    {
      id: 5, author: "Simone B.", initials: "SB", color: "#52b788",
      text: "I work in this space and the practical side is way more complicated than articles like this make out. That said — good starting point.",
      time: "5h ago", upvotes: 103, downvotes: 7, vote: null,
      replies: [
        { id: 51, author: "Raj M.", initials: "RM", color: "#2d6a4f", text: "Would love to hear more about the practical side — any resources you'd recommend?", time: "4h ago", upvotes: 31, downvotes: 0, vote: null },
        { id: 52, author: "Simone B.", initials: "SB", color: "#52b788", text: "I'll put together a reading list — DM me.", time: "3h ago", upvotes: 18, downvotes: 0, vote: null },
      ],
    },
    {
      id: 6, author: "Iris T.", initials: "IT", color: "#1b4332",
      text: "The last line really lands. Thought-provoking stuff.",
      time: "8h ago", upvotes: 48, downvotes: 1, vote: null,
      replies: [],
    },
  ],
  [
    {
      id: 1, author: "Marcus O.", initials: "MO", color: "#40916c",
      text: "Been following this story for months. The new angle here is interesting — didn't realise it had gone this far.",
      time: "45m ago", upvotes: 61, downvotes: 3, vote: null,
      replies: [
        { id: 11, author: "Priya S.", initials: "PS", color: "#2d6a4f", text: "Same. The timeline is wild when you map it out.", time: "30m ago", upvotes: 9, downvotes: 0, vote: null },
      ],
    },
    {
      id: 2, author: "Priya S.", initials: "PS", color: "#2d6a4f",
      text: "Every time I think I understand this fully, an article like this comes along.",
      time: "1h ago", upvotes: 38, downvotes: 0, vote: null,
      replies: [],
    },
    {
      id: 3, author: "Chris L.", initials: "CL", color: "#1a3c34",
      text: "Hot take: the real story isn't what's reported but what's being left out. Read between the lines.",
      time: "2h ago", upvotes: 77, downvotes: 22, vote: null,
      replies: [
        { id: 31, author: "Anya V.", initials: "AV", color: "#52b788", text: "What specifically do you think is being left out?", time: "1h ago", upvotes: 14, downvotes: 2, vote: null },
        { id: 32, author: "Chris L.", initials: "CL", color: "#1a3c34", text: "The funding sources. Always follow the money.", time: "55m ago", upvotes: 29, downvotes: 5, vote: null },
      ],
    },
    {
      id: 4, author: "Kwame R.", initials: "KR", color: "#1b4332",
      text: "Good summary. Would love a deeper dive into the economic angle specifically.",
      time: "5h ago", upvotes: 44, downvotes: 2, vote: null,
      replies: [],
    },
    {
      id: 5, author: "Nadia F.", initials: "NF", color: "#2d6a4f",
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

  const totalCount = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  const VoteRow = ({ upvotes, downvotes, vote, onUp, onDown }: {
    upvotes: number; downvotes: number; vote: "up" | "down" | null;
    onUp: (e: React.MouseEvent) => void; onDown: (e: React.MouseEvent) => void;
  }) => (
    <div className="flex items-center gap-4 mt-2">
      <button onClick={onUp} className="flex items-center gap-1 active:scale-95 transition-transform">
        <ChevronUp className="w-4 h-4" style={{ color: vote === "up" ? '#1b7a4a' : 'rgba(0,0,0,0.30)', strokeWidth: 2.5 }} />
        <span className="font-['Neue_Montreal'] font-medium" style={{ fontSize: '12px', color: vote === "up" ? '#1b7a4a' : 'rgba(0,0,0,0.35)' }}>{upvotes}</span>
      </button>
      <button onClick={onDown} className="flex items-center gap-1 active:scale-95 transition-transform">
        <ChevronDown className="w-4 h-4" style={{ color: vote === "down" ? '#c0392b' : 'rgba(0,0,0,0.30)', strokeWidth: 2.5 }} />
        <span className="font-['Neue_Montreal'] font-medium" style={{ fontSize: '12px', color: vote === "down" ? '#c0392b' : 'rgba(0,0,0,0.35)' }}>{downvotes}</span>
      </button>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 transition-opacity duration-300"
        style={{ background: 'rgba(0,0,0,0.40)', opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none' }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
        style={{
          height: '82dvh',
          background: 'rgba(236,243,239,0.97)',
          backdropFilter: 'blur(48px)',
          WebkitBackdropFilter: 'blur(48px)',
          borderRadius: '20px 20px 0 0',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1)',
        }}
        onClick={stopProp}
      >
        {/* Blobs */}
        <div className="absolute inset-0 rounded-[20px_20px_0_0] overflow-hidden pointer-events-none">
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle at 15% 25%, rgba(26,68,48,0.18) 0%, transparent 50%), radial-gradient(circle at 85% 70%, rgba(44,82,62,0.14) 0%, transparent 50%)`, filter: 'blur(40px)' }} />
        </div>

        {/* Handle */}
        <div className="relative z-10 flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(0,0,0,0.15)' }} />
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <div className="flex items-baseline gap-2">
            <span className="font-['Manrope'] font-bold" style={{ fontSize: '17px', color: '#000' }}>Comments</span>
            <span className="font-['Neue_Montreal']" style={{ fontSize: '13px', color: 'rgba(0,0,0,0.35)' }}>{totalCount}</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1 rounded-full transition-opacity hover:opacity-70">
            <X className="w-5 h-5" style={{ color: 'rgba(0,0,0,0.40)' }} />
          </button>
        </div>

        {/* Comments list */}
        <div className="relative z-10 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {comments.map((c, i) => {
            const repliesOpen = expandedReplies.has(c.id);
            return (
              <div key={c.id} style={{ borderBottom: i < comments.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
                {/* Top-level comment */}
                <div className="flex gap-3 px-5 pt-4 pb-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: c.color }}>
                    <span className="font-['Neue_Montreal'] font-bold text-white" style={{ fontSize: '11px' }}>{c.initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-['Neue_Montreal'] font-semibold" style={{ fontSize: '13px', color: '#000' }}>{c.author}</span>
                      <span className="font-['Neue_Montreal']" style={{ fontSize: '11px', color: 'rgba(0,0,0,0.35)' }}>{c.time}</span>
                    </div>
                    <p className="font-['Neue_Montreal'] leading-relaxed" style={{ fontSize: '14px', color: 'rgba(0,0,0,0.75)' }}>{c.text}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <VoteRow
                        upvotes={c.upvotes} downvotes={c.downvotes} vote={c.vote}
                        onUp={(e) => voteComment(e, c.id, "up")}
                        onDown={(e) => voteComment(e, c.id, "down")}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); setReplyTo({ id: c.id, author: c.author }); }}
                        className="font-['Neue_Montreal'] font-semibold transition-opacity hover:opacity-70"
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
                        <CornerDownRight className="w-3.5 h-3.5" style={{ color: '#000000' }} />
                        <span className="font-['Neue_Montreal'] font-semibold" style={{ fontSize: '12px', color: '#000000' }}>
                          {repliesOpen ? 'Hide' : `View`} {c.replies.length} {c.replies.length === 1 ? 'reply' : 'replies'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Replies */}
                {repliesOpen && c.replies.map((r) => (
                  <div key={r.id} className="flex gap-3 pl-14 pr-5 py-3" style={{ background: 'rgba(0,0,0,0.025)', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: r.color }}>
                      <span className="font-['Neue_Montreal'] font-bold text-white" style={{ fontSize: '10px' }}>{r.initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-['Neue_Montreal'] font-semibold" style={{ fontSize: '12px', color: '#000' }}>{r.author}</span>
                        <span className="font-['Neue_Montreal']" style={{ fontSize: '10px', color: 'rgba(0,0,0,0.35)' }}>{r.time}</span>
                      </div>
                      <p className="font-['Neue_Montreal'] leading-relaxed" style={{ fontSize: '13px', color: 'rgba(0,0,0,0.72)' }}>{r.text}</p>
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
          style={{ borderTop: '1px solid rgba(0,0,0,0.08)', background: 'rgba(236,243,239,0.60)' }}
        >
          {/* Reply target chip */}
          {replyTo && (
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="font-['Neue_Montreal']" style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)' }}>
                Replying to <span style={{ color: '#1b7a4a', fontWeight: 600 }}>@{replyTo.author}</span>
              </span>
              <button onClick={(e) => { e.stopPropagation(); setReplyTo(null); }} className="p-0.5">
                <X className="w-3.5 h-3.5" style={{ color: 'rgba(0,0,0,0.35)' }} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Your avatar */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: YOU.color }}>
              <span className="font-['Neue_Montreal'] font-bold text-white" style={{ fontSize: '10px' }}>{YOU.initials}</span>
            </div>

            {/* Input */}
            <div
              className="flex-1 flex items-center rounded-full px-4 py-2"
              style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)' }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onClick={stopProp}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleSend(e as any); }}
                placeholder={replyTo ? `Reply to ${replyTo.author}…` : "Add a comment…"}
                className="flex-1 bg-transparent outline-none font-['Neue_Montreal']"
                style={{ fontSize: '14px', color: '#000' }}
              />
            </div>

            {/* Send */}
            <button
              onClick={handleSend}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity"
              style={{ background: input.trim() ? '#000' : 'rgba(0,0,0,0.12)', pointerEvents: input.trim() ? 'auto' : 'none' }}
            >
              <SendHorizonal className="w-4 h-4" style={{ color: input.trim() ? '#fff' : 'rgba(0,0,0,0.30)' }} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
