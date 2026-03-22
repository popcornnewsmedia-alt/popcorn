import './_group.css';
import { Heart, Bookmark, Share2, Sparkles } from 'lucide-react';
import { useState } from 'react';

const article = {
  tag: 'Analysis',
  source: 'The Gradient',
  date: 'Mar 22',
  readTime: 5,
  title: 'The Diffusion Paradox: Beyond Neural Limits',
  likes: 1842,
};

const categories = ['For You', 'Models', 'Research', 'Industry', 'Policy'];

export function FocusedMinimal() {
  const [liked, setLiked] = useState(false);
  const [selectedCat, setSelectedCat] = useState('For You');

  return (
    <div
      style={{
        width: 390,
        height: 844,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: '#ecf3ef',
        backgroundImage: `
          radial-gradient(circle at 8% 15%, #1a443099 0%, transparent 45%),
          radial-gradient(circle at 88% 78%, #2c523e88 0%, transparent 45%),
          radial-gradient(circle at 50% 50%, #1f4b3840 0%, transparent 62%)
        `,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Atmosphere — fills the top ~55% */}
      <div style={{ flex: 1 }} />

      {/* Thin ruled separator — whisper-light */}
      <div style={{ height: 1, background: 'rgba(25,28,27,0.10)', margin: '0 20px' }} />

      {/* Card content — open, no rounded panel box */}
      <div
        style={{
          background: 'rgba(255,255,255,0.50)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          padding: '20px 24px 16px',
        }}
      >
        {/* Eyebrow — single line, wide tracking */}
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(71,71,71,0.6)',
            marginBottom: 10,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#191c1b', opacity: 1 }}>{article.tag}</span>
          <span style={{ opacity: 0.3 }}>—</span>
          <span>{article.source}</span>
        </div>

        {/* Headline — dominant, full weight */}
        <h2
          style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 38,
            fontWeight: 800,
            lineHeight: 1.0,
            color: '#191c1b',
            letterSpacing: '-0.025em',
            marginBottom: 18,
          }}
        >
          {article.title}
        </h2>

        {/* Bottom bar — date/time on left, compact icon row on right */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 11.5,
              fontWeight: 500,
              color: 'rgba(71,71,71,0.50)',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <span>{article.date}</span>
            <span>·</span>
            <span>{article.readTime} min read</span>
          </div>

          {/* Icon-only actions — very compact */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setLiked(!liked)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                borderRadius: 999,
                background: liked ? 'rgba(239,68,68,0.10)' : 'rgba(25,28,27,0.06)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                fontSize: 11.5,
                fontWeight: 600,
                color: liked ? '#dc2626' : '#191c1b',
              }}
            >
              <Heart size={12} fill={liked ? '#dc2626' : 'none'} stroke={liked ? '#dc2626' : '#191c1b'} strokeWidth={2.2} />
              {article.likes + (liked ? 1 : 0)}
            </button>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                borderRadius: 999,
                background: 'rgba(25,28,27,0.06)',
                border: 'none',
                cursor: 'pointer',
                color: '#191c1b',
              }}
            >
              <Bookmark size={12} strokeWidth={2.2} />
            </button>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                borderRadius: 999,
                background: 'rgba(25,28,27,0.06)',
                border: 'none',
                cursor: 'pointer',
                color: '#191c1b',
              }}
            >
              <Share2 size={12} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom nav — same green glass */}
      <div
        style={{
          background: 'rgba(236,243,239,0.65)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderTop: '1px solid rgba(255,255,255,0.28)',
          padding: '10px 16px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ flexShrink: 0, paddingRight: 10, borderRight: '1px solid rgba(25,28,27,0.09)' }}>
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

        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', flex: 1 }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              style={{
                padding: '7px 13px',
                borderRadius: 999,
                background: selectedCat === cat ? '#191c1b' : 'rgba(255,255,255,0.32)',
                color: selectedCat === cat ? '#e5e2e1' : '#191c1b',
                fontSize: 12.5,
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
