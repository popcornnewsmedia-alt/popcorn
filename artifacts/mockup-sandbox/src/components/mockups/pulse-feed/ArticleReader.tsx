import './_group.css';
import { ArrowLeft, Clock, Calendar, Sparkles } from 'lucide-react';
import { useState } from 'react';

const article = {
  tag: 'Analysis',
  source: 'The Gradient',
  date: 'March 22, 2026',
  readTime: 5,
  title: 'The Diffusion Paradox: Beyond Neural Limits',
  summary: 'How emergent architectures are redefining the relationship between computational cost and model capability — at a fraction of the scale we once assumed necessary.',
  image: '/__mockup/images/article-diffusion.png',
  body: [
    {
      type: 'p',
      text: 'The artificial intelligence landscape continues to evolve at a breakneck pace. In recent developments, industry leaders have unveiled new architectures that dramatically reduce compute requirements while maintaining — and in some cases exceeding — state-of-the-art performance.',
    },
    {
      type: 'h2',
      text: 'The Shift Toward Efficiency',
    },
    {
      type: 'p',
      text: 'Historically, the prevailing wisdom in model scaling was straightforward: more parameters and more data reliably led to better performance. However, as computational costs soar and physical constraints on data centers become apparent, researchers are finding innovative ways to achieve intelligence.',
    },
    {
      type: 'blockquote',
      text: '"We are moving from the era of brute-force scaling to an era of algorithmic elegance. The next major breakthroughs will come from how we structure networks, not just how large we can build them."',
    },
    {
      type: 'p',
      text: 'Early benchmarks suggest these new methods could reduce training costs by up to 40%, potentially democratizing access to high-tier AI capabilities. Startups and independent researchers may soon be able to deploy models that previously required massive corporate backing.',
    },
    {
      type: 'h2',
      text: 'Regulatory Implications',
    },
    {
      type: 'p',
      text: 'As these highly capable, lightweight models approach deployment, policymakers are accelerating their efforts to establish coherent frameworks for AI safety. The focus is shifting from simply monitoring massive data centers to establishing robust evaluation criteria for models that could potentially run on edge devices.',
    },
  ],
};

const categories = ['For You', 'Models', 'Research', 'Industry', 'Policy'];

export function ArticleReader() {
  const [selectedCat, setSelectedCat] = useState('For You');

  return (
    <div
      style={{
        width: 390,
        height: 844,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#ecf3ef',
        fontFamily: "'Inter', sans-serif",
        position: 'relative',
      }}
    >
      {/* Fixed header — floats above image */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.32)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <ArrowLeft size={15} strokeWidth={2.5} />
          Feed
        </button>

        <span
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.32)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.15)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,0.90)',
          }}
        >
          {article.tag}
        </span>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Hero image — top portion */}
        <div style={{ position: 'relative', height: 300, flexShrink: 0 }}>
          <img
            src={article.image}
            alt={article.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center top',
              display: 'block',
            }}
          />
          {/* Gradient: dark at top edges for header legibility, fades to green at bottom */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 40%, rgba(236,243,239,0) 70%, rgba(236,243,239,1) 100%)',
            }}
          />
        </div>

        {/* Green atmospheric content area */}
        <div
          style={{
            background: '#ecf3ef',
            backgroundImage: `
              radial-gradient(circle at 8% 30%, #1a443066 0%, transparent 50%),
              radial-gradient(circle at 88% 70%, #2c523e55 0%, transparent 50%)
            `,
            minHeight: 400,
            padding: '0 24px 100px',
          }}
        >
          {/* Source + meta */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 14,
              paddingTop: 4,
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(71,71,71,0.60)',
            }}
          >
            <span style={{ fontWeight: 700, color: '#191c1b' }}>{article.source}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={11} />
              {article.date}
            </span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} />
              {article.readTime} min
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: 34,
              fontWeight: 800,
              lineHeight: 1.08,
              color: '#191c1b',
              letterSpacing: '-0.022em',
              marginBottom: 16,
            }}
          >
            {article.title}
          </h1>

          {/* Lede — italic summary */}
          <p
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: 17,
              fontStyle: 'italic',
              color: '#474747',
              lineHeight: 1.55,
              marginBottom: 28,
              paddingBottom: 20,
              borderBottom: '1px solid rgba(25,28,27,0.10)',
            }}
          >
            {article.summary}
          </p>

          {/* Body content */}
          <div>
            {article.body.map((block, i) => {
              if (block.type === 'h2') {
                return (
                  <h2
                    key={i}
                    style={{
                      fontFamily: "'Manrope', sans-serif",
                      fontSize: 22,
                      fontWeight: 800,
                      color: '#191c1b',
                      letterSpacing: '-0.015em',
                      marginTop: 32,
                      marginBottom: 12,
                    }}
                  >
                    {block.text}
                  </h2>
                );
              }
              if (block.type === 'blockquote') {
                return (
                  <blockquote
                    key={i}
                    style={{
                      borderLeft: '3px solid rgba(25,28,27,0.25)',
                      paddingLeft: 18,
                      margin: '24px 0',
                      fontFamily: "'Manrope', sans-serif",
                      fontStyle: 'italic',
                      fontSize: 16,
                      color: 'rgba(71,71,71,0.85)',
                      lineHeight: 1.6,
                    }}
                  >
                    {block.text}
                  </blockquote>
                );
              }
              return (
                <p
                  key={i}
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 15.5,
                    color: '#3a3a3a',
                    lineHeight: 1.72,
                    marginBottom: 18,
                  }}
                >
                  {block.text}
                </p>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom nav — same as Focused Minimal */}
      <div
        style={{
          flexShrink: 0,
          background: 'rgba(10,15,13,0.80)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          padding: '10px 16px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
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
                color: selectedCat === cat ? '#191c1b' : 'rgba(255,255,255,0.72)',
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
