import './_group.css';
import { Heart, Bookmark, Share2, Sparkles, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const articles = [
  {
    tag: 'Analysis',
    source: 'The Gradient',
    date: 'Mar 22',
    readTime: 5,
    title: 'The Diffusion Paradox: Beyond Neural Limits',
    summary: 'How emergent architectures are redefining the relationship between computational cost and model capability.',
    likes: 1842,
    image: '/__mockup/images/article-diffusion.png',
  },
  {
    tag: 'Breaking',
    source: 'AI Insider',
    date: 'Mar 22',
    readTime: 5,
    title: "OpenAI's o3-mini Quietly Overtakes GPT-4 on Coding Benchmarks",
    summary: 'Internal evaluations suggest the compact model outperforms its larger predecessor on software engineering tasks — at one-fifth the inference cost.',
    likes: 3104,
    image: '/__mockup/images/article-chip.png',
  },
];

const categories = ['For You', 'Models', 'Research', 'Industry', 'Policy'];

function ArticleCard({ article, isFirst }: { article: typeof articles[0]; isFirst?: boolean }) {
  const [liked, setLiked] = useState(false);

  return (
    <div
      style={{
        width: 390,
        height: 844,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
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

      {/* Gradient overlay — darkens bottom for legibility, keeps image alive at top */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.30) 55%, rgba(0,0,0,0.60) 75%, rgba(0,0,0,0.80) 100%)',
          zIndex: 1,
        }}
      />

      {/* Spacer pushing card to bottom */}
      <div style={{ flex: 1, position: 'relative', zIndex: 2 }} />

      {/* Glass card — sits at bottom, floats over image */}
      <div style={{ position: 'relative', zIndex: 2, padding: '0 16px', paddingBottom: isFirst ? 0 : 0 }}>
        <div
          style={{
            borderRadius: '20px 20px 0 0',
            padding: '20px 20px 16px',
            background: 'rgba(255,255,255,0.14)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.22)',
            borderBottom: 'none',
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
              fontFamily: "'Inter', sans-serif",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.13em',
              textTransform: 'uppercase',
            }}
          >
            <span
              style={{
                padding: '3px 9px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.28)',
                color: 'rgba(255,255,255,0.95)',
              }}
            >
              {article.tag}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>{article.source}</span>
          </div>

          {/* Headline */}
          <h2
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: 28,
              fontWeight: 800,
              lineHeight: 1.1,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              marginBottom: 8,
            }}
          >
            {article.title}
          </h2>

          {/* Summary */}
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              color: 'rgba(255,255,255,0.72)',
              lineHeight: 1.5,
              marginBottom: 14,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
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
              borderTop: '1px solid rgba(255,255,255,0.12)',
              paddingTop: 12,
            }}
          >
            {/* Meta */}
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 11.5,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.50)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{article.date}</span>
              <span>·</span>
              <span>{article.readTime} min</span>
              <span>·</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <ChevronUp size={11} />
                Swipe
              </span>
            </div>

            {/* Action pills */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <button
                onClick={() => setLiked(!liked)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 11px',
                  borderRadius: 999,
                  background: liked ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.20)',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  color: liked ? '#fca5a5' : 'rgba(255,255,255,0.85)',
                }}
              >
                <Heart size={12} fill={liked ? '#fca5a5' : 'none'} stroke={liked ? '#fca5a5' : 'rgba(255,255,255,0.85)'} strokeWidth={2} />
                {article.likes + (liked ? 1 : 0)}
              </button>
              <button
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.20)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                <Bookmark size={12} strokeWidth={2} />
              </button>
              <button
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.20)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                <Share2 size={12} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WithImages() {
  const [selectedCat, setSelectedCat] = useState('For You');
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <div
      style={{
        width: 390,
        height: 844,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#0a0f0d',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Snap scroll area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          scrollSnapType: 'y mandatory',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {articles.map((article, i) => (
          <div key={i} style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
            <ArticleCard article={article} isFirst={i === 0} />
          </div>
        ))}
      </div>

      {/* Bottom nav — darker glass to sit over dark images */}
      <div
        style={{
          background: 'rgba(10,15,13,0.75)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          padding: '10px 16px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div style={{ flexShrink: 0, paddingRight: 10, borderRight: '1px solid rgba(255,255,255,0.12)' }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.95)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={14} color="#191c1b" />
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
                background: selectedCat === cat ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.10)',
                color: selectedCat === cat ? '#191c1b' : 'rgba(255,255,255,0.75)',
                fontSize: 12.5,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                border: '1px solid rgba(255,255,255,0.12)',
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
