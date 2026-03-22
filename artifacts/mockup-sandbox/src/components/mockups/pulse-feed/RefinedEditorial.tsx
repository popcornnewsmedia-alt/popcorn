import './_group.css';
import { Heart, Bookmark, Share2, Sparkles, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const article = {
  tag: 'Analysis',
  source: 'The Gradient',
  date: 'Mar 22',
  readTime: 5,
  title: 'The Diffusion Paradox: Beyond Neural Limits',
  summary: 'How emergent architectures are redefining the relationship between computational cost and model capability.',
  likes: 1842,
};

const categories = ['For You', 'Models', 'Research', 'Industry', 'Policy'];

export function RefinedEditorial() {
  const [liked, setLiked] = useState(false);
  const [selectedCat, setSelectedCat] = useState('For You');

  return (
    <div
      className="relative overflow-hidden flex flex-col"
      style={{
        width: 390,
        height: 844,
        background: '#ecf3ef',
        backgroundImage: `
          radial-gradient(circle at 8% 15%, #1a443099 0%, transparent 45%),
          radial-gradient(circle at 88% 78%, #2c523e88 0%, transparent 45%),
          radial-gradient(circle at 50% 50%, #1f4b3840 0%, transparent 62%)
        `,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Upper atmosphere — breathes freely */}
      <div className="flex-1" />

      {/* Glass card panel */}
      <div className="px-4 pb-0">
        <div
          className="rounded-2xl px-6 pt-6 pb-5"
          style={{
            background: 'rgba(255,255,255,0.45)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.40)',
            boxShadow: '0 8px 40px rgba(25,28,27,0.10)',
          }}
        >
          {/* Eyebrow — editorial style, no pill */}
          <div
            className="flex items-center gap-2 mb-3"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#191c1b',
              }}
            >
              {article.tag}
            </span>
            <span style={{ color: '#191c1b', opacity: 0.25, fontSize: 10 }}>·</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                color: '#474747',
                opacity: 0.7,
              }}
            >
              {article.source}
            </span>
          </div>

          {/* Headline */}
          <h2
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: 34,
              fontWeight: 800,
              lineHeight: 1.06,
              color: '#191c1b',
              letterSpacing: '-0.02em',
              marginBottom: 12,
            }}
          >
            {article.title}
          </h2>

          {/* Summary */}
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 13.5,
              color: '#474747',
              lineHeight: 1.55,
              marginBottom: 16,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {article.summary}
          </p>

          {/* Bottom row — metadata + actions in one clean strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid rgba(25,28,27,0.07)',
              paddingTop: 14,
            }}
          >
            {/* Meta */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontFamily: "'Inter', sans-serif",
                fontSize: 11.5,
                fontWeight: 500,
                color: 'rgba(71,71,71,0.55)',
              }}
            >
              <span>{article.date}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{article.readTime} min</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <ChevronUp size={11} />
                Tap
              </span>
            </div>

            {/* Action pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setLiked(!liked)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: liked ? 'rgba(239,68,68,0.12)' : 'rgba(25,28,27,0.07)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  color: liked ? '#dc2626' : '#191c1b',
                }}
              >
                <Heart size={13} fill={liked ? '#dc2626' : 'none'} stroke={liked ? '#dc2626' : '#191c1b'} strokeWidth={2} />
                {article.likes + (liked ? 1 : 0)}
              </button>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  background: 'rgba(25,28,27,0.07)',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#191c1b',
                }}
              >
                <Bookmark size={14} strokeWidth={2} />
              </button>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  background: 'rgba(25,28,27,0.07)',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#191c1b',
                }}
              >
                <Share2 size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div
        style={{
          background: 'rgba(236,243,239,0.62)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderTop: '1px solid rgba(255,255,255,0.25)',
          padding: '10px 16px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {/* Logo */}
        <div style={{ flexShrink: 0, paddingRight: 10, borderRight: '1px solid rgba(25,28,27,0.10)' }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: '#191c1b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={14} color="white" />
          </div>
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1 }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              style={{
                padding: '7px 14px',
                borderRadius: 999,
                background: selectedCat === cat ? '#191c1b' : 'rgba(255,255,255,0.35)',
                color: selectedCat === cat ? '#e5e2e1' : '#191c1b',
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
