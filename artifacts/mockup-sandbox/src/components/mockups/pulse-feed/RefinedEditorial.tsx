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
  image: '/__mockup/images/article-diffusion.png',
};

const categories = ['For You', 'Models', 'Research', 'Industry', 'Policy'];

export function RefinedEditorial() {
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
        background: '#0a0f0d',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Full-bleed article image */}
      <img
        src={article.image}
        alt={article.title}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center top',
        }}
      />

      {/* Gradient overlay — heavy at bottom for card legibility */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.28) 50%, rgba(0,0,0,0.62) 70%, rgba(0,0,0,0.82) 100%)',
          zIndex: 1,
        }}
      />

      {/* Spacer */}
      <div style={{ flex: 1, position: 'relative', zIndex: 2 }} />

      {/* Glass card panel */}
      <div style={{ position: 'relative', zIndex: 2, padding: '0 16px' }}>
        <div
          style={{
            borderRadius: '18px 18px 0 0',
            padding: '20px 20px 16px',
            background: 'rgba(255,255,255,0.13)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.20)',
            borderBottom: 'none',
          }}
        >
          {/* Eyebrow — editorial, no pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.95)' }}>
              {article.tag}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>·</span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.55)' }}>
              {article.source}
            </span>
          </div>

          {/* Headline */}
          <h2
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: 30,
              fontWeight: 800,
              lineHeight: 1.08,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              marginBottom: 10,
            }}
          >
            {article.title}
          </h2>

          {/* Summary */}
          <p
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.68)',
              lineHeight: 1.55,
              marginBottom: 14,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden',
            }}
          >
            {article.summary}
          </p>

          {/* Bottom row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid rgba(255,255,255,0.10)',
              paddingTop: 12,
            }}
          >
            {/* Meta */}
            <div style={{ fontSize: 11.5, fontWeight: 500, color: 'rgba(255,255,255,0.42)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{article.date}</span>
              <span>·</span>
              <span>{article.readTime} min</span>
              <span>·</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <ChevronUp size={11} />
                Tap
              </span>
            </div>

            {/* Action pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <button
                onClick={() => setLiked(!liked)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 999,
                  background: liked ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  color: liked ? '#fca5a5' : 'rgba(255,255,255,0.82)',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <Heart size={12} fill={liked ? '#fca5a5' : 'none'} stroke={liked ? '#fca5a5' : 'rgba(255,255,255,0.82)'} strokeWidth={2} />
                {article.likes + (liked ? 1 : 0)}
              </button>
              {[Bookmark, Share2].map((Icon, i) => (
                <button key={i} style={{ width: 30, height: 30, borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.82)' }}>
                  <Icon size={12} strokeWidth={2} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div
        style={{
          position: 'relative', zIndex: 2,
          background: 'rgba(10,15,13,0.78)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          padding: '10px 16px 12px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}
      >
        <div style={{ flexShrink: 0, paddingRight: 10, borderRight: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={14} color="#191c1b" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', flex: 1 }}>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setSelectedCat(cat)}
              style={{
                padding: '7px 13px', borderRadius: 999,
                background: selectedCat === cat ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.10)',
                color: selectedCat === cat ? '#191c1b' : 'rgba(255,255,255,0.72)',
                fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
                border: '1px solid rgba(255,255,255,0.12)',
                cursor: 'pointer', flexShrink: 0,
                fontFamily: "'Inter', sans-serif",
              }}
            >{cat}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
