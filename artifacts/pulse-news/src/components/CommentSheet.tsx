import { useState, useEffect } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";

interface Comment {
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

const SAMPLE_POOLS: Comment[][] = [
  [
    { id: 1, author: "Lena Park", initials: "LP", color: "#2d6a4f", text: "This is genuinely one of the more nuanced takes I've seen on this topic. The second paragraph alone changed how I'm thinking about it.", time: "1h ago", upvotes: 84, downvotes: 2, vote: null },
    { id: 2, author: "Tom Wills", initials: "TW", color: "#1b4332", text: "Paywall got me on the original article but this summary is solid. Anyone have a link to the full paper?", time: "2h ago", upvotes: 31, downvotes: 1, vote: null },
    { id: 3, author: "Farah N.", initials: "FN", color: "#40916c", text: "The framing here is a bit misleading. The study had a sample size of 200 — hardly groundbreaking. Still interesting though.", time: "3h ago", upvotes: 56, downvotes: 14, vote: null },
    { id: 4, author: "Dev K.", initials: "DK", color: "#1a3c34", text: "Saved. Will read properly tonight.", time: "3h ago", upvotes: 12, downvotes: 0, vote: null },
    { id: 5, author: "Simone B.", initials: "SB", color: "#52b788", text: "I work in this space and the practical side is way more complicated than articles like this make out. That said — good starting point.", time: "5h ago", upvotes: 103, downvotes: 7, vote: null },
    { id: 6, author: "Raj M.", initials: "RM", color: "#2d6a4f", text: "Imagine if this was covered by mainstream media with actual depth. One can dream.", time: "6h ago", upvotes: 29, downvotes: 4, vote: null },
    { id: 7, author: "Iris T.", initials: "IT", color: "#1b4332", text: "The last line really lands. Thought-provoking stuff.", time: "8h ago", upvotes: 48, downvotes: 1, vote: null },
  ],
  [
    { id: 1, author: "Marcus O.", initials: "MO", color: "#40916c", text: "Been following this story for months. The new angle here is interesting — didn't realise it had gone this far.", time: "45m ago", upvotes: 61, downvotes: 3, vote: null },
    { id: 2, author: "Priya S.", initials: "PS", color: "#2d6a4f", text: "Every time I think I understand this fully, an article like this comes along.", time: "1h ago", upvotes: 38, downvotes: 0, vote: null },
    { id: 3, author: "Chris L.", initials: "CL", color: "#1a3c34", text: "Hot take: the real story isn't what's reported but what's being left out. Read between the lines.", time: "2h ago", upvotes: 77, downvotes: 22, vote: null },
    { id: 4, author: "Anya V.", initials: "AV", color: "#52b788", text: "Sharing this to my team. This has real implications for what we're building.", time: "4h ago", upvotes: 19, downvotes: 1, vote: null },
    { id: 5, author: "Kwame R.", initials: "KR", color: "#1b4332", text: "Good summary. Would love a deeper dive into the economic angle specifically.", time: "5h ago", upvotes: 44, downvotes: 2, vote: null },
    { id: 6, author: "Nadia F.", initials: "NF", color: "#2d6a4f", text: "Counterpoint: we've been hearing this for three years and nothing has materially changed. I'll believe it when I see it.", time: "7h ago", upvotes: 55, downvotes: 18, vote: null },
  ],
];

interface CommentSheetProps {
  isOpen: boolean;
  articleId: number;
  onClose: () => void;
}

export function CommentSheet({ isOpen, articleId, onClose }: CommentSheetProps) {
  const pool = SAMPLE_POOLS[articleId % SAMPLE_POOLS.length];
  const [comments, setComments] = useState<Comment[]>(pool.map(c => ({ ...c })));

  useEffect(() => {
    const fresh = SAMPLE_POOLS[articleId % SAMPLE_POOLS.length];
    setComments(fresh.map(c => ({ ...c })));
  }, [articleId]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const vote = (e: React.MouseEvent, id: number, dir: "up" | "down") => {
    e.stopPropagation();
    setComments(prev => prev.map(c => {
      if (c.id !== id) return c;
      if (c.vote === dir) {
        return { ...c, vote: null, upvotes: dir === "up" ? c.upvotes - 1 : c.upvotes, downvotes: dir === "down" ? c.downvotes - 1 : c.downvotes };
      }
      const wasUp = c.vote === "up";
      const wasDown = c.vote === "down";
      return {
        ...c,
        vote: dir,
        upvotes: dir === "up" ? c.upvotes + 1 : wasUp ? c.upvotes - 1 : c.upvotes,
        downvotes: dir === "down" ? c.downvotes + 1 : wasDown ? c.downvotes - 1 : c.downvotes,
      };
    }));
  };

  return (
    <>
      {/* Backdrop — stops propagation so the article card doesn't open */}
      <div
        className="fixed inset-0 z-50 transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.40)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col transition-transform duration-350 ease-out"
        style={{
          height: '78dvh',
          background: 'rgba(236, 243, 239, 0.97)',
          backdropFilter: 'blur(48px)',
          WebkitBackdropFilter: 'blur(48px)',
          borderRadius: '20px 20px 0 0',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Atmospheric blobs */}
        <div className="absolute inset-0 rounded-[20px_20px_0_0] overflow-hidden pointer-events-none -z-0">
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `
              radial-gradient(circle at 15% 25%, rgba(26,68,48,0.18) 0%, transparent 50%),
              radial-gradient(circle at 85% 70%, rgba(44,82,62,0.14) 0%, transparent 50%)
            `,
            filter: 'blur(40px)',
          }} />
        </div>

        {/* Handle */}
        <div className="relative z-10 flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(0,0,0,0.15)' }} />
        </div>

        {/* Header */}
        <div
          className="relative z-10 flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}
        >
          <span className="font-['Manrope'] font-bold" style={{ fontSize: '17px', color: '#000000' }}>
            Comments
          </span>
          <span className="font-['Inter'] text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>
            {comments.length}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1 rounded-full transition-opacity hover:opacity-70"
          >
            <X className="w-5 h-5" style={{ color: 'rgba(0,0,0,0.40)' }} />
          </button>
        </div>

        {/* Comments list */}
        <div className="relative z-10 flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: 'none' }}>
          {comments.map((c, i) => (
            <div
              key={c.id}
              className="flex gap-3 px-5 py-4"
              style={{ borderBottom: i < comments.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}
            >
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: c.color }}
              >
                <span className="font-['Inter'] font-bold text-white" style={{ fontSize: '11px' }}>{c.initials}</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-['Inter'] font-semibold" style={{ fontSize: '13px', color: '#000000' }}>{c.author}</span>
                  <span className="font-['Inter']" style={{ fontSize: '11px', color: 'rgba(0,0,0,0.35)' }}>{c.time}</span>
                </div>
                <p className="font-['Inter'] leading-relaxed" style={{ fontSize: '14px', color: 'rgba(0,0,0,0.75)' }}>
                  {c.text}
                </p>

                {/* Vote row */}
                <div className="flex items-center gap-4 mt-2.5">
                  <button onClick={(e) => vote(e, c.id, "up")} className="flex items-center gap-1 active:scale-95 transition-transform">
                    <ChevronUp
                      className="w-4 h-4"
                      style={{ color: c.vote === "up" ? '#1b7a4a' : 'rgba(0,0,0,0.30)', strokeWidth: 2.5 }}
                    />
                    <span className="font-['Inter'] font-medium" style={{ fontSize: '12px', color: c.vote === "up" ? '#1b7a4a' : 'rgba(0,0,0,0.35)' }}>
                      {c.upvotes}
                    </span>
                  </button>
                  <button onClick={(e) => vote(e, c.id, "down")} className="flex items-center gap-1 active:scale-95 transition-transform">
                    <ChevronDown
                      className="w-4 h-4"
                      style={{ color: c.vote === "down" ? '#c0392b' : 'rgba(0,0,0,0.30)', strokeWidth: 2.5 }}
                    />
                    <span className="font-['Inter'] font-medium" style={{ fontSize: '12px', color: c.vote === "down" ? '#c0392b' : 'rgba(0,0,0,0.35)' }}>
                      {c.downvotes}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
