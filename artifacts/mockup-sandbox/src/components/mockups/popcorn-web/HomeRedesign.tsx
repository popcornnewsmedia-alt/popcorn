import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";

/* =====================================================================
 *  POPCORN — DESKTOP HOME (volv-inspired re-skin)
 *  Edgy editorial. Massive stacked type. Theater-marquee glow.
 *  Halftone print texture. Asymmetric off-grid. Surprising motion.
 *  Brand colors only: cream #FDF1E0 · blue #053980 · yellow accent.
 *  No vol/no, no est. dates, no "printed fresh daily" meta.
 * ===================================================================== */

const BLUE = "#053980";
const BLUE_INK = "#021637";
const BLUE_SOFT = "#0a4aa3";
const CREAM = "#FDF1E0";
const CREAM_WARM = "#F7E5C9";
const YELLOW = "#F5C463";
const YELLOW_HOT = "#FFD571";
const COAL = "#0a0a0a";

/* ------------------------------- DATA ------------------------------- */

type Article = {
  id: string;
  title: string;
  dek?: string;
  source: string;
  category: string;
  tag?: string;
  image: string;
  readMin?: number;
};

const HERO: Article = {
  id: "hero",
  title: "Eleven's Fate, Sealed.",
  dek:
    "Inside a Brooklyn warehouse, the Duffer Brothers walk us through the most expensive episode of television ever shot — a love letter, a goodbye, and the close of a decade-long bet on weird kids and synth music.",
  source: "Variety",
  category: "Film & TV",
  tag: "The Lead",
  image:
    "https://images.unsplash.com/photo-1518929458119-e5bf444c30f4?w=2000&q=85&auto=format&fit=crop",
  readMin: 9,
};

const FRONT_ROW: Article[] = [
  {
    id: "a1",
    title: "Ronaldo, At Six.",
    dek: "A goal in the 87th minute. A nation in pieces.",
    source: "The Athletic",
    category: "Sports",
    tag: "Breaking",
    image:
      "https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1400&q=85&auto=format&fit=crop",
    readMin: 4,
  },
  {
    id: "a2",
    title: "Smart Glasses, Finally Pretty.",
    dek: "Google and Samsung put a Gemini chip behind every blink.",
    source: "The Verge",
    category: "Tech",
    tag: "Release",
    image:
      "https://images.unsplash.com/photo-1591814468924-caf88d1232e1?w=1400&q=85&auto=format&fit=crop",
    readMin: 5,
  },
  {
    id: "a3",
    title: "The Housemaid Takes Broadway.",
    dek: "Freida McFadden's thriller heads for an eight-show week.",
    source: "Deadline",
    category: "Culture",
    image:
      "https://images.unsplash.com/photo-1503095396549-807759245b35?w=1400&q=85&auto=format&fit=crop",
    readMin: 3,
  },
  {
    id: "a4",
    title: "Billy Joel Signs Off.",
    dek: "The Piano Man writes a letter to fans — and to time.",
    source: "Rolling Stone",
    category: "Music",
    tag: "Statement",
    image:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1400&q=85&auto=format&fit=crop",
    readMin: 6,
  },
];

const GRID_STORIES: Article[] = [
  {
    id: "g1",
    title: "Spotify Beefs With Apple Music, Round Nine",
    source: "Pitchfork",
    category: "Music",
    image:
      "https://images.unsplash.com/photo-1611339555312-e607c8352fd7?w=1400&q=85&auto=format&fit=crop",
    readMin: 4,
  },
  {
    id: "g2",
    title: "Alcaraz Takes Madrid In Straight Sets",
    source: "ESPN",
    category: "Sports",
    image:
      "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=1400&q=85&auto=format&fit=crop",
    readMin: 3,
  },
  {
    id: "g3",
    title: "Nashville Locks In Super Bowl 2030",
    source: "AP",
    category: "Sports",
    tag: "Breaking",
    image:
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1400&q=85&auto=format&fit=crop",
    readMin: 2,
  },
  {
    id: "g4",
    title: "Taiwan Travelogue Wins International Booker",
    source: "The Guardian",
    category: "Books",
    image:
      "https://images.unsplash.com/photo-1474932430478-367dbb6832c1?w=1400&q=85&auto=format&fit=crop",
    readMin: 5,
  },
  {
    id: "g5",
    title: "Saka's Left Foot Decides The North London Derby",
    source: "Sky Sports",
    category: "Sports",
    image:
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1400&q=85&auto=format&fit=crop",
    readMin: 3,
  },
  {
    id: "g6",
    title: "Southampton Hit With Six-Point Spygate Deduction",
    source: "BBC Sport",
    category: "Sports",
    image:
      "https://images.unsplash.com/photo-1551958219-acbc608c6377?w=1400&q=85&auto=format&fit=crop",
    readMin: 4,
  },
  {
    id: "g7",
    title: "Jonas Bros Open Nashville Podcast Studio",
    source: "Billboard",
    category: "Music",
    image:
      "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1400&q=85&auto=format&fit=crop",
    readMin: 2,
  },
  {
    id: "g8",
    title: "Charli XCX Buys A Recording Studio In Hackney",
    source: "NME",
    category: "Music",
    image:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1400&q=85&auto=format&fit=crop",
    readMin: 3,
  },
];

const CATEGORIES = [
  "All",
  "Film & TV",
  "Music",
  "Internet",
  "Culture",
  "Fashion",
  "Tech",
  "AI",
  "Gaming",
  "Sports",
  "World",
  "Science",
  "Books",
  "Industry",
];

const TICKER = [
  "Eleven returns",
  "Ronaldo at six",
  "Smart glasses, finally pretty",
  "Billy Joel signs off",
  "Spotify v. Apple, round nine",
  "Booker goes to Taipei",
  "Saka's left foot",
  "Charli XCX gets Hackney",
  "Jonas Bros open studio",
  "Alcaraz takes Madrid",
  "Nashville gets the bowl",
  "Southampton, again",
];

/* --------------------------- TEXTURE ATOMS --------------------------- */

function GrainNoise({ id, opacity = 0.08, freq = 0.9 }: { id: string; opacity?: number; freq?: number }) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ opacity, mixBlendMode: "multiply" }}
    >
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

function HalftoneOverlay({ size = 4, color = BLUE_INK, opacity = 0.32 }: { size?: number; color?: string; opacity?: number }) {
  // Tiny pattern of dots — print halftone vibe over images.
  const id = `ht-${size}-${color.replace("#", "")}`;
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity, mixBlendMode: "multiply" }}>
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          <circle cx={size / 2} cy={size / 2} r={size / 4} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function FilmPerforation({ vertical = false, color = CREAM, count = 12 }: { vertical?: boolean; color?: string; count?: number }) {
  return (
    <div className={`flex ${vertical ? "flex-col items-center" : "items-center"} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ width: 14, height: 18, background: color, borderRadius: 2 }} />
      ))}
    </div>
  );
}

function Sprocket({ color = CREAM, count = 32 }: { color?: string; count?: number }) {
  return (
    <div className="flex items-center justify-between" style={{ gap: 0 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ width: 10, height: 14, background: color, borderRadius: 1.5 }} />
      ))}
    </div>
  );
}

/* ------------------- MARQUEE THEATER BULBS ------------------------ */
/* The unforgettable moment: vintage cinema marquee with chasing bulbs.
   Bulbs pulse on sequentially with staggered keyframes. ------------- */

function MarqueeBulbStrip({ count = 38, color = YELLOW_HOT, glow = YELLOW }: { count?: number; color?: string; glow?: string }) {
  return (
    <div className="flex w-full items-center justify-between" style={{ height: 14 }}>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: color,
            boxShadow: `0 0 6px 1px ${glow}, 0 0 14px 3px ${glow}55`,
            animation: `bulbChase 1.6s ${(i * 0.06).toFixed(2)}s infinite ease-in-out`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------ TOPBAR ------------------------------ */

function Topbar() {
  const [now, setNow] = useState(new Date(2026, 4, 21, 7, 14));
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(i);
  }, []);
  return (
    <div
      className="relative z-30"
      style={{
        background: BLUE,
        color: CREAM,
        fontFamily: "'Geist', 'Inter', sans-serif",
      }}
    >
      <GrainNoise id="grain-top" opacity={0.16} />
      <div
        className="relative mx-auto flex max-w-[1600px] items-center justify-between px-10"
        style={{ height: 44 }}
      >
        <div
          className="flex items-center gap-5 text-[10px]"
          style={{ letterSpacing: "0.32em", fontWeight: 500 }}
        >
          <span style={{ color: YELLOW_HOT }}>● LIVE</span>
          <span style={{ opacity: 0.4 }}>/</span>
          <span>
            {now
              .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
              .toUpperCase()}
          </span>
          <span style={{ opacity: 0.4 }}>/</span>
          <span style={{ opacity: 0.7 }}>BANGKOK</span>
        </div>
        <button
          className="group flex items-center gap-2 text-[10px]"
          style={{
            background: CREAM,
            color: BLUE_INK,
            padding: "6px 14px",
            letterSpacing: "0.32em",
            fontWeight: 700,
            borderRadius: 999,
          }}
        >
          SIGN IN
          <span className="transition-transform group-hover:translate-x-0.5">↗</span>
        </button>
      </div>
    </div>
  );
}

/* --------------------------- MASTHEAD ------------------------------- */
/* DRENCHED blue masthead band. POPCORN wordmark wrapped in theater
   marquee bulbs (top + bottom). Asymmetric placement of the bucket
   logo. Halftone wash. ---------------------------------------------- */

function Masthead() {
  return (
    <div className="relative overflow-hidden" style={{ background: BLUE, color: CREAM }}>
      <GrainNoise id="grain-mh" opacity={0.22} />
      <HalftoneOverlay size={6} color={BLUE_INK} opacity={0.18} />

      {/* off-grid logo bucket — sneaks in from the right, oversized */}
      <motion.img
        src="/popcorn-logo.png"
        alt=""
        aria-hidden
        draggable={false}
        initial={{ opacity: 0, y: 40, rotate: -8 }}
        animate={{ opacity: 1, y: 0, rotate: -6 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        className="pointer-events-none absolute select-none"
        style={{
          right: "-2vw",
          top: "12%",
          width: "min(34vw, 480px)",
          filter:
            "brightness(0) saturate(100%) invert(85%) sepia(28%) saturate(386%) hue-rotate(345deg) brightness(99%) contrast(98%) drop-shadow(0 12px 30px rgba(0,0,0,0.35))",
          opacity: 0.92,
        }}
      />

      <div className="relative mx-auto max-w-[1600px] px-10 pt-14 pb-12">
        {/* top bulb strip */}
        <MarqueeBulbStrip count={42} />

        {/* WORDMARK */}
        <div className="relative mt-6 mb-6">
          <h1
            className="relative leading-[0.82]"
            style={{
              fontFamily: "'Playfair Display', 'Source Serif 4', serif",
              fontWeight: 900,
              fontStyle: "italic",
              fontSize: "clamp(7rem, 17vw, 19rem)",
              letterSpacing: "-0.055em",
              color: CREAM,
              textShadow: `0 0 1px ${CREAM}`,
            }}
          >
            <motion.span
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="relative inline-block"
            >
              Popcorn
              {/* yellow underscore — bleeds off baseline */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: "0%",
                  bottom: "9%",
                  height: "0.09em",
                  width: "62%",
                  background: YELLOW_HOT,
                  transform: "skewX(-12deg)",
                }}
              />
            </motion.span>
          </h1>

          {/* tiny tracked corner marker */}
          <div
            className="absolute"
            style={{
              right: 0,
              top: "12%",
              fontFamily: "'Geist Mono', 'IBM Plex Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.42em",
              color: CREAM,
              opacity: 0.6,
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
            }}
          >
            ⟶ FILE 142 / TODAY
          </div>
        </div>

        {/* bottom bulb strip */}
        <MarqueeBulbStrip count={42} />
      </div>
    </div>
  );
}

/* ----------------------- STATEMENT TAGLINE -------------------------- */
/* Volv-style stacked condensed display. Mixed roman + italic. Off-axis.
   Asymmetric, the second-to-last line indented. -------------------- */

function StatementTagline() {
  return (
    <section className="relative overflow-hidden" style={{ background: CREAM, color: BLUE_INK }}>
      <GrainNoise id="grain-st" opacity={0.1} freq={1.2} />

      <div className="relative mx-auto max-w-[1600px] px-10 pt-24 pb-20">
        {/* tiny eyebrow */}
        <div
          className="mb-10 flex items-center gap-3"
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.42em",
            color: BLUE,
          }}
        >
          <span style={{ width: 32, height: 1, background: BLUE }} />
          <span>WHAT YOU MISSED IN POP CULTURE</span>
        </div>

        <h2
          className="relative"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 900,
            fontSize: "clamp(72px, 12.5vw, 220px)",
            lineHeight: 0.86,
            letterSpacing: "-0.045em",
            color: BLUE,
          }}
        >
          <StaggerLine>
            <span style={{ fontStyle: "italic" }}>Today's</span> pop
          </StaggerLine>
          <StaggerLine delay={0.08}>culture, briefed</StaggerLine>
          <StaggerLine delay={0.16} indent="9vw">
            in <span style={{ color: YELLOW_HOT, background: BLUE, padding: "0 0.12em 0.04em", borderRadius: 6 }}>20 minutes</span>
          </StaggerLine>
          <StaggerLine delay={0.24}>
            <span style={{ fontStyle: "italic", opacity: 0.55 }}>flat.</span>
          </StaggerLine>
        </h2>

        <div
          className="mt-10 flex items-end justify-between gap-8"
          style={{ borderTop: `1px solid ${BLUE}`, paddingTop: 16 }}
        >
          <p
            style={{
              fontFamily: "'Source Serif 4', 'Newsreader', serif",
              fontSize: "clamp(15px, 1.1vw, 18px)",
              lineHeight: 1.5,
              color: BLUE_INK,
              maxWidth: 420,
              opacity: 0.86,
            }}
          >
            A daily, hand-built read for people who'd rather not scroll for 90&nbsp;minutes to learn what
            their group chat already knows. We do the trawling. You catch up before coffee gets cold.
          </p>
          <div
            className="hidden md:block"
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.42em",
              color: BLUE,
              opacity: 0.55,
              textAlign: "right",
            }}
          >
            ⟶ SCROLL FOR TODAY'S CUT
          </div>
        </div>
      </div>
    </section>
  );
}

function StaggerLine({ children, delay = 0, indent }: { children: React.ReactNode; delay?: number; indent?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  return (
    <div ref={ref} className="overflow-hidden" style={{ marginLeft: indent }}>
      <motion.div
        initial={{ y: "108%" }}
        animate={inView ? { y: 0 } : { y: "108%" }}
        transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1], delay }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/* ------------------------- CATEGORY STRIP --------------------------- */

function CategoryStrip() {
  const [active, setActive] = useState("All");
  return (
    <section className="relative" style={{ background: CREAM_WARM, color: BLUE_INK }}>
      <GrainNoise id="grain-cat" opacity={0.08} freq={1.1} />
      <div
        className="relative mx-auto max-w-[1600px] overflow-x-auto px-10 py-5"
        style={{ borderTop: `1px solid ${BLUE}33`, borderBottom: `1px solid ${BLUE}33` }}
      >
        <div className="flex items-center gap-1 whitespace-nowrap">
          {CATEGORIES.map((c) => {
            const isActive = c === active;
            return (
              <button
                key={c}
                onClick={() => setActive(c)}
                className="group relative px-3 py-2 transition-colors"
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 10.5,
                  letterSpacing: "0.32em",
                  fontWeight: 600,
                  color: isActive ? CREAM : BLUE_INK,
                  background: isActive ? BLUE : "transparent",
                  borderRadius: 4,
                }}
              >
                {c.toUpperCase()}
                {!isActive && (
                  <span
                    className="absolute left-1/2 bottom-1 h-[1px] w-0 -translate-x-1/2 transition-all duration-300 group-hover:w-4/5"
                    style={{ background: BLUE }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- KINETIC TICKER ------------------------- */

function Ticker() {
  const repeated = useMemo(() => [...TICKER, ...TICKER, ...TICKER], []);
  return (
    <section className="relative overflow-hidden" style={{ background: YELLOW_HOT, color: BLUE_INK }}>
      <HalftoneOverlay size={5} color={BLUE_INK} opacity={0.12} />
      <div
        className="relative flex"
        style={{ animation: "marquee 38s linear infinite", whiteSpace: "nowrap" }}
      >
        {repeated.map((line, i) => (
          <span
            key={i}
            className="flex items-center"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: i % 2 === 0 ? "italic" : "normal",
              fontWeight: 900,
              fontSize: "clamp(28px, 3.4vw, 60px)",
              lineHeight: 1,
              padding: "16px 28px",
              color: BLUE_INK,
            }}
          >
            {line}
            <span
              aria-hidden
              className="ml-7"
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                borderRadius: 999,
                background: BLUE,
              }}
            />
          </span>
        ))}
      </div>
    </section>
  );
}

/* ----------------------- ASYMMETRIC HERO ---------------------------- */
/* Image bleeds the full left 60% off the edge. Massive headline
   overlaps the bottom-left corner of the image, breaking the grid. -- */

function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);
  const imgScale = useTransform(scrollYProgress, [0, 1], [1.08, 1.0]);

  return (
    <section
      ref={ref}
      className="relative"
      style={{ background: CREAM, color: BLUE_INK }}
    >
      <GrainNoise id="grain-hero" opacity={0.1} />
      <div className="relative mx-auto max-w-[1600px] px-10 pt-20 pb-28">
        <div className="grid grid-cols-12 gap-x-8 gap-y-12">
          {/* tiny meta */}
          <div className="col-span-12 flex items-center justify-between">
            <div
              className="flex items-center gap-3"
              style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: "0.42em", color: BLUE }}
            >
              <span style={{ background: BLUE, color: CREAM, padding: "3px 8px", borderRadius: 3 }}>
                01
              </span>
              <span>THE LEAD</span>
              <span style={{ opacity: 0.4 }}>/</span>
              <span>{HERO.category.toUpperCase()}</span>
            </div>
            <div
              style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: "0.42em", color: BLUE, opacity: 0.6 }}
            >
              {HERO.source.toUpperCase()} · {HERO.readMin} MIN
            </div>
          </div>

          {/* Image — bleeds left */}
          <div className="col-span-12 lg:col-span-8 relative">
            <motion.div
              initial={{ opacity: 0, scale: 1.05 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-20%" }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden"
              style={{
                aspectRatio: "16/10",
                marginLeft: "-4vw",
                background: BLUE,
              }}
            >
              <motion.img
                src={HERO.image}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                style={{ y: imgY, scale: imgScale, filter: "saturate(0.95) contrast(1.06)" }}
              />
              <HalftoneOverlay size={3.5} color={BLUE_INK} opacity={0.18} />
              {/* film leader corner mark */}
              <div
                aria-hidden
                className="absolute"
                style={{
                  top: 22,
                  left: "5vw",
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.42em",
                  color: CREAM,
                  background: BLUE,
                  padding: "5px 9px",
                  borderRadius: 3,
                }}
              >
                ROLL · 01 · TAKE · 142
              </div>
            </motion.div>
          </div>

          {/* Tag block — right column */}
          <div className="col-span-12 lg:col-span-4 flex flex-col justify-between">
            <div>
              <div
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 9.5,
                  letterSpacing: "0.42em",
                  color: BLUE,
                  opacity: 0.55,
                  marginBottom: 18,
                }}
              >
                ↘ KEEP READING
              </div>
              <p
                style={{
                  fontFamily: "'Source Serif 4', 'Newsreader', serif",
                  fontStyle: "italic",
                  fontSize: 19,
                  lineHeight: 1.42,
                  color: BLUE_INK,
                }}
              >
                {HERO.dek}
              </p>
            </div>
            <div className="mt-8 flex items-center gap-3">
              <button
                className="group flex items-center gap-3"
                style={{
                  background: BLUE,
                  color: CREAM,
                  padding: "13px 22px",
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 11,
                  letterSpacing: "0.36em",
                  fontWeight: 600,
                  borderRadius: 999,
                }}
              >
                READ THE FULL STORY
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>

          {/* Massive headline — overlaps image */}
          <div className="col-span-12 -mt-32 lg:-mt-44 relative z-10">
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 900,
                fontSize: "clamp(72px, 13vw, 220px)",
                lineHeight: 0.84,
                letterSpacing: "-0.05em",
                color: BLUE,
                maxWidth: "78%",
              }}
            >
              <StaggerLine>
                <span style={{ fontStyle: "italic" }}>Eleven's</span> Fate,
              </StaggerLine>
              <StaggerLine delay={0.1} indent="14vw">
                Sealed.
              </StaggerLine>
            </h2>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------- FILM LEADER COUNTDOWN ------------------------ */
/* Big rotating countdown disk — 3 / 2 / 1 — like a film leader, with
   sprocket holes flanking. Pure decoration, but unforgettable. ----- */

function FilmLeader() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const rot = useTransform(scrollYProgress, [0, 1], [0, 360]);
  const stage = useTransform(scrollYProgress, [0, 0.33, 0.66, 1], [3, 2, 1, 1]);
  const [num, setNum] = useState(3);
  useEffect(() => stage.on("change", (v) => setNum(Math.max(1, Math.round(v)))), [stage]);

  return (
    <section
      ref={ref}
      className="relative overflow-hidden"
      style={{ background: BLUE, color: CREAM }}
    >
      <GrainNoise id="grain-fl" opacity={0.22} />
      <HalftoneOverlay size={5} color={BLUE_INK} opacity={0.18} />

      {/* sprocket strips */}
      <div className="absolute inset-x-0 top-5 px-3"><Sprocket count={42} /></div>
      <div className="absolute inset-x-0 bottom-5 px-3"><Sprocket count={42} /></div>

      <div className="relative mx-auto max-w-[1600px] px-10 py-28">
        <div className="grid grid-cols-12 items-center gap-8">
          <div className="col-span-12 lg:col-span-5">
            <div
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.42em",
                color: YELLOW_HOT,
                marginBottom: 16,
              }}
            >
              ↘ NOW ROLLING
            </div>
            <h3
              style={{
                fontFamily: "'Playfair Display', serif",
                fontStyle: "italic",
                fontWeight: 900,
                fontSize: "clamp(56px, 8vw, 140px)",
                lineHeight: 0.9,
                letterSpacing: "-0.04em",
                color: CREAM,
              }}
            >
              The reel
              <br />
              keeps spinning.
            </h3>
            <p
              className="mt-6 max-w-md"
              style={{
                fontFamily: "'Source Serif 4', serif",
                fontSize: 17,
                lineHeight: 1.5,
                color: CREAM,
                opacity: 0.78,
              }}
            >
              Twelve more reads queued for the day. Music, sport, the internet's weirdest cul-de-sacs.
            </p>
          </div>

          <div className="col-span-12 lg:col-span-7 flex justify-center">
            <motion.div
              style={{ rotate: rot }}
              className="relative"
            >
              <div
                style={{
                  width: "min(60vh, 520px)",
                  height: "min(60vh, 520px)",
                  borderRadius: "50%",
                  border: `2px solid ${CREAM}`,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 18,
                    borderRadius: "50%",
                    border: `1px dashed ${CREAM}55`,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <motion.span
                    key={num}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontWeight: 900,
                      fontStyle: "italic",
                      fontSize: "clamp(140px, 22vw, 360px)",
                      color: YELLOW_HOT,
                      lineHeight: 1,
                      transform: "translateZ(0)",
                    }}
                  >
                    {num}
                  </motion.span>
                </div>
                {/* crosshairs */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: "50%",
                    width: 1,
                    background: `${CREAM}33`,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "50%",
                    height: 1,
                    background: `${CREAM}33`,
                  }}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- FRONT ROW ---------------------------- */
/* Irregular grid of 4 stories. Sizes vary, image positions vary,
   hover causes image to desaturate to blue, headline shifts yellow. - */

function FrontRow() {
  return (
    <section className="relative" style={{ background: CREAM, color: BLUE_INK }}>
      <GrainNoise id="grain-fr" opacity={0.09} />
      <div className="relative mx-auto max-w-[1600px] px-10 pt-20 pb-12">
        <SectionHeader number="02" label="FRONT ROW" right="UPDATED HOURLY" />

        <div className="mt-12 grid grid-cols-12 gap-x-8 gap-y-16">
          {/* 1 — wide left */}
          <StoryCard article={FRONT_ROW[0]} className="col-span-12 lg:col-span-7" big imageHeight="60vh" />
          {/* 2 — narrow right */}
          <StoryCard article={FRONT_ROW[1]} className="col-span-12 lg:col-span-5 lg:mt-32" imageHeight="36vh" />
          {/* 3 — narrow left, low */}
          <StoryCard article={FRONT_ROW[2]} className="col-span-12 lg:col-span-5 lg:mt-8" imageHeight="34vh" />
          {/* 4 — wide right */}
          <StoryCard article={FRONT_ROW[3]} className="col-span-12 lg:col-span-7 lg:-mt-20" big imageHeight="54vh" />
        </div>
      </div>
    </section>
  );
}

function StoryCard({
  article,
  className = "",
  big = false,
  imageHeight = "40vh",
}: {
  article: Article;
  className?: string;
  big?: boolean;
  imageHeight?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.article
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12%" }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group cursor-pointer ${className}`}
    >
      {/* meta line */}
      <div
        className="mb-3 flex items-center justify-between"
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.4em",
          color: BLUE,
        }}
      >
        <span className="flex items-center gap-3">
          <span style={{ background: BLUE, color: CREAM, padding: "3px 7px", borderRadius: 3 }}>
            {article.category.toUpperCase()}
          </span>
          {article.tag && (
            <span style={{ color: YELLOW_HOT, background: BLUE_INK, padding: "3px 7px", borderRadius: 3 }}>
              {article.tag.toUpperCase()}
            </span>
          )}
        </span>
        <span style={{ opacity: 0.55 }}>{article.source.toUpperCase()} · {article.readMin} MIN</span>
      </div>

      {/* image */}
      <div
        className="relative overflow-hidden"
        style={{ height: imageHeight, background: BLUE }}
      >
        <motion.img
          src={article.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          animate={{
            scale: hovered ? 1.05 : 1,
            filter: hovered
              ? "saturate(0) brightness(0.55) contrast(1.2)"
              : "saturate(0.92) contrast(1.04)",
          }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
        {/* blue duotone on hover */}
        <motion.div
          aria-hidden
          className="absolute inset-0"
          style={{ background: BLUE, mixBlendMode: "color" }}
          animate={{ opacity: hovered ? 0.65 : 0 }}
          transition={{ duration: 0.4 }}
        />
        <HalftoneOverlay size={3.5} color={BLUE_INK} opacity={hovered ? 0.32 : 0.18} />

        {/* hover marquee bulbs */}
        <motion.div
          className="absolute inset-x-0 bottom-3 px-3"
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <MarqueeBulbStrip count={28} />
        </motion.div>
      </div>

      {/* headline */}
      <h3
        className="mt-5"
        style={{
          fontFamily: "'Playfair Display', serif",
          fontWeight: 900,
          fontStyle: hovered ? "italic" : "normal",
          fontSize: big ? "clamp(34px, 4.4vw, 64px)" : "clamp(24px, 2.6vw, 38px)",
          lineHeight: 0.96,
          letterSpacing: "-0.022em",
          color: BLUE,
          transition: "font-style 0.3s ease",
        }}
      >
        {article.title}
      </h3>

      {article.dek && (
        <p
          className="mt-3 max-w-[36ch]"
          style={{
            fontFamily: "'Source Serif 4', serif",
            fontStyle: "italic",
            fontSize: big ? 18 : 15.5,
            lineHeight: 1.45,
            color: BLUE_INK,
            opacity: 0.82,
          }}
        >
          {article.dek}
        </p>
      )}
    </motion.article>
  );
}

function SectionHeader({ number, label, right }: { number: string; label: string; right?: string }) {
  return (
    <div className="flex items-end justify-between" style={{ borderBottom: `1px solid ${BLUE}55`, paddingBottom: 14 }}>
      <div className="flex items-end gap-5">
        <span
          style={{
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: "clamp(60px, 8vw, 140px)",
            lineHeight: 0.86,
            letterSpacing: "-0.04em",
            color: BLUE,
          }}
        >
          {number}
        </span>
        <span
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 12,
            letterSpacing: "0.42em",
            fontWeight: 600,
            color: BLUE,
            paddingBottom: 14,
          }}
        >
          {label}
        </span>
      </div>
      {right && (
        <span
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 10.5,
            letterSpacing: "0.42em",
            color: BLUE,
            opacity: 0.55,
            paddingBottom: 14,
          }}
        >
          {right}
        </span>
      )}
    </div>
  );
}

/* ----------------------------- TETRIS GRID -------------------------- */

function TetrisGrid() {
  return (
    <section className="relative" style={{ background: CREAM, color: BLUE_INK }}>
      <GrainNoise id="grain-tg" opacity={0.09} />
      <div className="relative mx-auto max-w-[1600px] px-10 pt-12 pb-24">
        <SectionHeader number="03" label="MORE TO CHEW ON" right="12 STORIES" />

        <div className="mt-12 grid grid-cols-12 gap-x-7 gap-y-14">
          <StoryCard article={GRID_STORIES[0]} className="col-span-12 md:col-span-6 lg:col-span-4" imageHeight="32vh" />
          <StoryCard article={GRID_STORIES[1]} className="col-span-12 md:col-span-6 lg:col-span-5 lg:mt-12" imageHeight="38vh" />
          <StoryCard article={GRID_STORIES[2]} className="col-span-12 md:col-span-6 lg:col-span-3" imageHeight="24vh" />

          <StoryCard article={GRID_STORIES[3]} className="col-span-12 md:col-span-6 lg:col-span-5" imageHeight="42vh" />
          <StoryCard article={GRID_STORIES[4]} className="col-span-12 md:col-span-6 lg:col-span-3 lg:mt-20" imageHeight="26vh" />
          <StoryCard article={GRID_STORIES[5]} className="col-span-12 md:col-span-6 lg:col-span-4" imageHeight="34vh" />

          <StoryCard article={GRID_STORIES[6]} className="col-span-12 md:col-span-6 lg:col-span-4 lg:-mt-8" imageHeight="30vh" />
          <StoryCard article={GRID_STORIES[7]} className="col-span-12 md:col-span-6 lg:col-span-7" big imageHeight="48vh" />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- FOOTER ----------------------------- */

function Footer() {
  return (
    <footer className="relative overflow-hidden" style={{ background: BLUE, color: CREAM }}>
      <GrainNoise id="grain-ft" opacity={0.22} />
      <HalftoneOverlay size={5} color={BLUE_INK} opacity={0.16} />

      <div className="relative pt-6">
        <MarqueeBulbStrip count={50} />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-10 pt-16 pb-10">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-7">
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 900,
                fontStyle: "italic",
                fontSize: "clamp(80px, 14vw, 240px)",
                lineHeight: 0.82,
                letterSpacing: "-0.05em",
                color: CREAM,
              }}
            >
              See you
              <br />
              <span style={{ color: YELLOW_HOT }}>tomorrow.</span>
            </h2>
            <p
              className="mt-6 max-w-md"
              style={{
                fontFamily: "'Source Serif 4', serif",
                fontStyle: "italic",
                fontSize: 18,
                lineHeight: 1.5,
                color: CREAM,
                opacity: 0.82,
              }}
            >
              Same time. Different stories. New popcorn, fresh kernels, ready by sunrise.
            </p>
          </div>

          <div className="col-span-6 lg:col-span-3">
            <div
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 10.5,
                letterSpacing: "0.42em",
                color: YELLOW_HOT,
                marginBottom: 14,
              }}
            >
              GET IT FIRST
            </div>
            <form className="flex items-center" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="you@something.com"
                className="flex-1 bg-transparent outline-none"
                style={{
                  fontFamily: "'Source Serif 4', serif",
                  fontStyle: "italic",
                  fontSize: 16,
                  color: CREAM,
                  borderBottom: `1px solid ${CREAM}55`,
                  paddingBottom: 8,
                }}
              />
              <button
                type="submit"
                className="ml-3"
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 10.5,
                  letterSpacing: "0.42em",
                  color: BLUE_INK,
                  background: YELLOW_HOT,
                  padding: "9px 14px",
                  borderRadius: 999,
                  fontWeight: 700,
                }}
              >
                JOIN ↗
              </button>
            </form>
          </div>

          <div className="col-span-6 lg:col-span-2 flex flex-col gap-3"
               style={{
                 fontFamily: "'Geist Mono', monospace",
                 fontSize: 10.5,
                 letterSpacing: "0.42em",
                 color: CREAM,
               }}>
            <a href="#" className="hover:opacity-100" style={{ opacity: 0.78 }}>ABOUT</a>
            <a href="#" className="hover:opacity-100" style={{ opacity: 0.78 }}>IOS APP ↗</a>
            <a href="#" className="hover:opacity-100" style={{ opacity: 0.78 }}>CONTACT</a>
            <a href="#" className="hover:opacity-100" style={{ opacity: 0.78 }}>PRIVACY</a>
          </div>
        </div>

        <div className="mt-16 flex items-end justify-between" style={{ borderTop: `1px solid ${CREAM}33`, paddingTop: 14 }}>
          <span
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 10.5,
              letterSpacing: "0.42em",
              color: CREAM,
              opacity: 0.6,
            }}
          >
            © POPCORN MEDIA
          </span>
          <span
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 10.5,
              letterSpacing: "0.42em",
              color: CREAM,
              opacity: 0.6,
            }}
          >
            BANGKOK / NEW YORK / LONDON
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ----------------------- KEYFRAMES (inline) ------------------------- */

function Keyframes() {
  return (
    <style>{`
      @keyframes bulbChase {
        0%, 100% { opacity: 0.18; transform: scale(0.85); }
        45%, 55% { opacity: 1; transform: scale(1.08); }
      }
      @keyframes marquee {
        from { transform: translateX(0); }
        to   { transform: translateX(-33.333%); }
      }
      @keyframes flicker {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.85; }
      }
    `}</style>
  );
}

/* ------------------------------ ROOT -------------------------------- */

export default function HomeRedesign() {
  return (
    <div style={{ background: CREAM, color: BLUE_INK, fontFamily: "'Source Serif 4', serif" }}>
      <Keyframes />
      <Topbar />
      <Masthead />
      <StatementTagline />
      <CategoryStrip />
      <Ticker />
      <Hero />
      <FilmLeader />
      <FrontRow />
      <TetrisGrid />
      <Footer />
    </div>
  );
}
