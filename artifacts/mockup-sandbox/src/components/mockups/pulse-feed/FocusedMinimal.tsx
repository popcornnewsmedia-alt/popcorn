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
  image: '/__mockup/images/article-chip.png',
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

      {/* Gradient — lighter fade, keeps more of the image visible */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.20) 55%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.78) 100%)',
          zIndex: 1,
        }}
      />

      {/* Spacer — image breathes in the top ~55% */}
      <div style={{ flex: 1, position: 'relative', zIndex: 2 }} />

      {/* Thin ruled separator */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '0 20px', position: 'relative', zIndex: 2 }} />

      {/* Card content — open layout, no rounded box */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          padding: '18px 24px 14px',
        }}
      >
        {/* Eyebrow */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>
          <span style={{ color: 'rgba(255,255,255,0.95)' }}>{article.tag}</span>
          <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>
          <span style={{ color: 'rgba(255,255,255,0.50)' }}>{article.source}</span>
        </div>

        {/* Headline — dominant */}
        <h2
          style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 36,
            fontWeight: 800,
            lineHeight: 1.0,
            color: '#ffffff',
            letterSpacing: '-0.025em',
            marginBottom: 16,
          }}
        >
          {article.title}
        </h2>

        {/* Bottom bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: 'rgba(255,255,255,0.40)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>{article.date}</span>
            <span>·</span>
            <span>{article.readTime} min read</span>
          </div>

          {/* Compact icon actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setLiked(!liked)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 999,
                background: liked ? 'rgba(239,68,68,0.20)' : 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.14)',
                cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                color: liked ? '#fca5a5' : 'rgba(255,255,255,0.80)',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <Heart size={12} fill={liked ? '#fca5a5' : 'none'} stroke={liked ? '#fca5a5' : 'rgba(255,255,255,0.80)'} strokeWidth={2.2} />
              {article.likes + (liked ? 1 : 0)}
            </button>
            {[Bookmark, Share2].map((Icon, i) => (
              <button key={i} style={{ width: 30, height: 30, borderRadius: 999, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.80)' }}>
                <Icon size={12} strokeWidth={2.2} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div
        style={{
          position: 'relative', zIndex: 2,
          background: 'rgba(10,15,13,0.80)',
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
