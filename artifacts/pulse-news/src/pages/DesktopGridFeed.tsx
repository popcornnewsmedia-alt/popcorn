import { useState, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { Instagram } from "lucide-react";
import type { NewsArticle } from "@workspace/api-client-react";
import { feedImageUrl } from "@/lib/image-url";
import { GrainBackground } from "@/components/GrainBackground";

/* ─────────────────────────────────────────────────────────────────────
   Popcorn — Grid view, "The Daily Edit".
   A disciplined editorial front page in the spirit of AnOther / Dazed:
   one strong hierarchy, executed strictly —

     Cover story        giant didone headline + image with blue plate
     ── hairline ──
     Featured pair      two equal 3:2 cards, ruled column between
     ── hairline ──
     The rest           uniform rows of three 4:5 cards, hairline-ruled
                        columns, identical anatomy throughout
     App-ad band        full-bleed signature blue, flickering montage
     ── hairline ──
     Closing            Instagram card + the daily sign-off

   No randomness: every card shares one anatomy (mono category line →
   didone headline, always ink-black), but image TREATMENTS cycle row by
   row in a fixed rhythm borrowed from the drag rail — plain photo,
   offset colour block, gallery ink frame, polaroid mat — plus one
   headline-in-image overlay card in the featured pair. The signature
   blue (#042c85) is confined to category marks, the cover plate, one
   offset block and the two brand bands.
   ───────────────────────────────────────────────────────────────────── */

const INK   = "#0a0a0a";
const MUTE  = "#6e6e6e";
const BLUE  = "#042c85";
const CREAM = "#f1ead9";
const HAIR  = "rgba(10,10,10,0.14)";

const DISPLAY = '"Canela", "Bodoni Moda", serif';
const DEK     = '"Newsreader", Georgia, serif';
const MONO    = '"DM Mono", "SF Mono", monospace';

const MAX_W = 1480;

/* Same montage the splash intro flickers through — the kept app-ad concept. */
const AD_FRAMES: ReadonlyArray<string> = [
  "/category-images/Film-TV.png",
  "/category-images/Music.png",
  "/category-images/AI.png",
  "/category-images/Internet.png",
  "/category-images/Sports.png",
  "/category-images/Culture.png",
  "/category-images/World.png",
  "/category-images/Fashion.png",
  "/category-images/Tech.png",
  "/category-images/Gaming.png",
  "/category-images/Space.png",
];

/* Focal-point aware object-position so faces stay in frame. */
const focalPos = (a: NewsArticle): string | undefined => {
  if (a.imageFocalX == null || a.imageFocalY == null) return undefined;
  return `${Math.round(a.imageFocalX * 100)}% ${Math.round(a.imageFocalY * 100)}%`;
};

/* ── Scroll reveal ──────────────────────────────────────────────────── */
function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.04 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`gv-rv ${inView ? "is-in" : ""} ${className}`}>
      {children}
    </div>
  );
}

/* ── Shared atoms ───────────────────────────────────────────────────── */
function Kicker({ label, light = false }: { label: string; light?: boolean }) {
  return (
    <span className={`gv-kicker ${light ? "is-light" : ""}`}>
      <i aria-hidden className="gv-kicker__sq" />
      {label}
    </span>
  );
}

/* Functional byline — read time only. */
function Foot({ a, light = false }: { a: NewsArticle; light?: boolean }) {
  const rt = a.readTimeMinutes ? `${a.readTimeMinutes} min read` : null;
  if (!rt) return null;
  return (
    <div className={`gv-foot ${light ? "is-light" : ""}`}>
      <span className="gv-foot__rt">{rt}</span>
    </div>
  );
}

/* Slim reading-progress hairline pinned to the very top of the page. */
function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return <div className="gv-progress" style={{ transform: `scaleX(${p})` }} aria-hidden />;
}

function CardImage({ a, eager = false }: { a: NewsArticle; eager?: boolean }) {
  const src = a.imageUrl ? feedImageUrl(a.imageUrl) : null;
  if (!src) return null;
  return (
    // key={src} forces a fresh <img> when the source changes (e.g. flicking
    // between days). Without it React reuses the DOM node and the browser keeps
    // painting the previous photo until the new one decodes — a frozen-stale frame.
    <img
      key={src}
      src={src}
      alt=""
      loading={eager ? "eager" : "lazy"}
      draggable={false}
      style={{ objectPosition: focalPos(a), animation: "articleImageIn 420ms ease-out" }}
    />
  );
}

/* ── Cover — the day's lead story ───────────────────────────────────── */
function CoverModule({ a, onOpen }: { a: NewsArticle; onOpen: () => void }) {
  const hasImg = Boolean(a.imageUrl);
  if (!hasImg) {
    return (
      <Reveal>
        <a className="gv-cover gv-cover--text" href="#" onClick={(e) => { e.preventDefault(); onOpen(); }}>
          <Kicker label={a.category || "Today"} />
          <h1 className="gv-cover__title">{a.title}</h1>
          {a.summary && <p className="gv-cover__dek">{a.summary}</p>}
          <span className="gv-readcue">Read the story <i>→</i></span>
        </a>
      </Reveal>
    );
  }
  return (
    <Reveal>
      <a className="gv-cover" href="#" onClick={(e) => { e.preventDefault(); onOpen(); }}>
        <div className="gv-cover__txt">
          <Kicker label={a.category || "Today"} />
          <h1 className="gv-cover__title">{a.title}</h1>
          {a.summary && <p className="gv-cover__dek">{a.summary}</p>}
          <div className="gv-cover__foot">
            <span className="gv-readcue">Read the story <i>→</i></span>
            <Foot a={a} />
          </div>
        </div>
        <div className="gv-cover__imgwrap">
          <span aria-hidden className="gv-cover__block" />
          <div className="gv-img gv-cover__img">
            <CardImage a={a} eager />
          </div>
        </div>
      </a>
    </Reveal>
  );
}

/* ── Story card — one anatomy everywhere ─────────────────────────────
   feature: 3:2 image, large title, dek.
   std:     4:5 image, compact title.
   `treat` swaps the PHOTO'S dressing only (anatomy never changes),
   borrowing the drag rail's frames:
     plain  — bare photo
     pop    — hard cream offset block, tightens on hover
     pop2   — same in signature blue
     framed — gallery ink frame: thin line, breathing gap, lifts on hover
     mat    — polaroid mat: white border, deeper at the foot
     edge   — flush hairline border drawn on the photo (Elephant-style)
   Image-less stories become cream colour-block cards with identical
   proportions so rows never break. */
export type CardTreat = "plain" | "pop" | "pop2" | "framed" | "mat" | "edge";

function StoryCard({
  a,
  onOpen,
  size,
  treat = "plain",
}: {
  a: NewsArticle;
  onOpen: () => void;
  size: "feature" | "std";
  treat?: CardTreat;
}) {
  const ratio = size === "feature" ? "3/2" : "1/1";

  if (!a.imageUrl) {
    return (
      <a
        className={`gv-card gv-card--${size} gv-card--text`}
        href="#"
        onClick={(e) => { e.preventDefault(); onOpen(); }}
      >
        <div className="gv-card--text__box" style={{ aspectRatio: ratio }}>
          <span className="gv-card--text__cat">{a.category || "Today"}</span>
          <h3 className="gv-card--text__title">{a.title}</h3>
          <span className="gv-card--text__cue">Read <i>→</i></span>
        </div>
        <Foot a={a} />
      </a>
    );
  }

  return (
    <a
      className={`gv-card gv-card--${size} gv-card--t-${treat}`}
      href="#"
      onClick={(e) => { e.preventDefault(); onOpen(); }}
    >
      <div className="gv-img" style={{ aspectRatio: ratio }}>
        <CardImage a={a} />
      </div>
      <div className="gv-meta">
        <span className="gv-meta__cat">{a.category || "Today"}</span>
        <span className="gv-meta__rule" />
        <span className="gv-meta__arr">↗</span>
      </div>
      <h3 className="gv-title">{a.title}</h3>
      {size === "feature" && a.summary && <p className="gv-dek">{a.summary}</p>}
      <Foot a={a} />
    </a>
  );
}

/* ── Overlay card — the one card whose headline lives INSIDE the photo,
   in white over a deep shade. Used for the second featured slot. ────── */
function OverlayCard({ a, onOpen }: { a: NewsArticle; onOpen: () => void }) {
  if (!a.imageUrl) return <StoryCard a={a} onOpen={onOpen} size="feature" />;
  return (
    <a
      className="gv-card gv-card--overlay"
      href="#"
      onClick={(e) => { e.preventDefault(); onOpen(); }}
    >
      <div className="gv-img gv-overlay__img">
        <CardImage a={a} />
        <span aria-hidden className="gv-overlay__shade" />
        <div className="gv-overlay__txt">
          <span className="gv-overlay__cat">{a.category || "Today"}</span>
          <h3 className="gv-overlay__title">{a.title}</h3>
          <div className="gv-overlay__bottom">
            <span className="gv-overlay__cue">Read <i>→</i></span>
            <Foot a={a} light />
          </div>
        </div>
      </div>
    </a>
  );
}

/* ── Statement — the day's biggest, most artistic frame, run nearly
   full-width to break the uniform grid. Image on top, headline + dek set
   below in an editorial two-column. ─────────────────────────────────── */
function StatementModule({ a, onOpen }: { a: NewsArticle; onOpen: () => void }) {
  if (!a.imageUrl) return null;
  return (
    <Reveal className="gv-statementwrap">
      <a className="gv-statement gv-card" href="#" onClick={(e) => { e.preventDefault(); onOpen(); }}>
        <div className="gv-img gv-statement__img">
          <CardImage a={a} />
          <span className="gv-statement__tag">The big picture</span>
        </div>
        <div className="gv-statement__txt">
          <div className="gv-statement__lead">
            <span className="gv-statement__cat">{a.category || "Today"}</span>
            <h2 className="gv-statement__title">{a.title}</h2>
          </div>
          <div className="gv-statement__side">
            {a.summary && <p className="gv-statement__dek">{a.summary}</p>}
            <div className="gv-statement__foot">
              <span className="gv-readcue">Read the story <i>→</i></span>
              <Foot a={a} />
            </div>
          </div>
        </div>
      </a>
    </Reveal>
  );
}

/* ── Culture — three photographs "pinned" like prints on a table
   (Marfa Journal energy): unequal sizes, staggered drops, a slight hand
   rotation that straightens on hover, thin print mats, and a mono index
   over an italic caption headline. Lots of air. The rest of the day's
   stories continue under it. ────────────────────────────────────────── */
const SNAP_MOD = ["a", "b", "c"] as const;
const CULTURE_POSTER = {
  src: "/posters/culture-poster.png",
  alt: "Popcorn — Stop Stumbling On Culture",
};

function CultureSection({
  items,
  onOpen,
}: {
  items: NewsArticle[];
  onOpen: (a: NewsArticle) => void;
}) {
  const snaps = items.slice(0, 3);
  if (snaps.length === 0) return null;

  return (
    <Reveal className="gv-culture gv-block">
      <div className="gv-div">
        <span className="gv-div__label">Culture</span>
        <span className="gv-div__rule" />
      </div>

      <div className="gv-culture__snaps">
        {snaps.map((a, i) => (
          <a
            key={a.id}
            className={`gv-snap gv-snap--${SNAP_MOD[i] ?? "a"} gv-card`}
            href="#"
            onClick={(e) => { e.preventDefault(); onOpen(a); }}
          >
            <div className="gv-snap__print">
              <div className="gv-img gv-snap__img">
                <CardImage a={a} />
              </div>
            </div>
            <span className="gv-snap__idx">{a.category || "Culture"}</span>
            <h4 className="gv-snap__title">{a.title}</h4>
          </a>
        ))}

        {/* A Popcorn poster pinned in among the photos — same print
            treatment, no caption (it speaks for itself). */}
        <div className="gv-snap gv-snap--d gv-snap--poster">
          <div className="gv-snap__print">
            <div className="gv-img gv-snap__img">
              <img src={CULTURE_POSTER.src} alt={CULTURE_POSTER.alt} loading="lazy" draggable={false} />
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* ── App-ad band — the kept "splashing images" concept, re-staged ──────
   Full-bleed signature-blue band; the montage flickers inside a clean
   cream-plated window. Mirrors the cover's plate, in negative. */
function AppAdBand() {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => setLive(Boolean(es[0]?.isIntersecting)), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setI((p) => (p + 1) % AD_FRAMES.length), 240);
    return () => window.clearInterval(id);
  }, [live]);

  return (
    <Reveal className="gv-adwrap">
      <section ref={ref} className="gv-ad" aria-label="Download the Popcorn app">
        <div aria-hidden className="gv-ad__grain"><GrainBackground variant="popcorn-blue" /></div>
        <div className="gv-ad__txt">
          <Kicker label="Popcorn for iOS" light />
          <h3 className="gv-ad__title">The whole pop,<br /><em>in your pocket.</em></h3>
          <p className="gv-ad__sub">Today's culture, hand-curated every evening — flick through it just like this.</p>
          <a className="gv-ad__btn" href="#" onClick={(e) => e.stopPropagation()}>Download the app <i>→</i></a>
        </div>
        <div className="gv-ad__stage">
          <span aria-hidden className="gv-ad__block" />
          <div className="gv-ad__frame">
            {AD_FRAMES.map((src, n) => (
              <img key={src} src={src} alt="" className={n === i ? "is-on" : ""} draggable={false} />
            ))}
          </div>
        </div>
      </section>
    </Reveal>
  );
}

/* ── Closing band — Instagram card + the daily sign-off ─────────────── */
function ClosingBand() {
  return (
    <Reveal className="gv-closewrap">
      <div className="gv-close">
        <a
          className="gv-ig"
          href="https://instagram.com/news.popcorn"
          target="_blank"
          rel="noreferrer"
          aria-label="Follow Popcorn on Instagram"
        >
          <div aria-hidden className="gv-ig__grain"><GrainBackground variant="popcorn-blue" /></div>
          <div className="gv-ig__head">
            <Instagram size={15} strokeWidth={1.6} />
            <span>Instagram</span>
          </div>
          <div className="gv-ig__mid">
            <span className="gv-ig__logo"><img src="/logo-latest.png" alt="" loading="lazy" /></span>
            <span className="gv-ig__handle">@news.popcorn</span>
          </div>
          <span className="gv-ig__cue">Follow <i>→</i></span>
        </a>
        <div className="gv-close__note">
          <p className="gv-close__line">More pop <em>tomorrow.</em></p>
          <span className="gv-close__sub">A new edit, hand-curated every evening</span>
        </div>
      </div>
    </Reveal>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────── */
/* Treatments cycle PER CARD through a fixed sequence of six distinct
   framings, so every 4-up row is a fresh mix (diverse like a magazine
   spread) yet wholly deterministic — never random, and never two of the
   same framing side by side. */
const TREAT_CYCLE: ReadonlyArray<CardTreat> = ["plain", "framed", "pop", "mat", "edge", "pop2"];
const PER_ROW = 4;

const chunk = <T,>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

export function GridFeed({
  articles,
  onOpen,
}: {
  articles: NewsArticle[];
  onOpen: (a: NewsArticle) => void;
}) {
  const { cover, featured, statement, culture, rows } = useMemo(() => {
    const cover = articles[0] ?? null;
    const rest = articles.slice(1);
    const featured = rest.slice(0, 2);
    const pool = rest.slice(2);

    /* Pull ONE statement image out of the grid pool — the day's biggest,
       most artistic frame (largest pixel area; signalScore breaks ties) —
       to run near-full-width and break the uniform rhythm. */
    let statement: NewsArticle | null = null;
    let bestIdx = -1;
    let bestScore = -1;
    pool.forEach((a, i) => {
      if (!a.imageUrl) return;
      const area = (a.imageWidth ?? 0) * (a.imageHeight ?? 0);
      const score = area > 0 ? area : (a.signalScore ?? 0);
      if (score > bestScore) { bestScore = score; statement = a; bestIdx = i; }
    });
    const afterStatement = bestIdx >= 0 ? pool.filter((_, i) => i !== bestIdx) : pool;

    /* Pull THREE imaged stories for the "Culture" spread that sits under
       the app-ad band — one lead + two cover-style cards. Pulled from the
       front of the remaining pool, as a deliberate second-wind highlight. */
    const culture: NewsArticle[] = [];
    const remaining = afterStatement.filter((a) => {
      if (culture.length < 3 && a.imageUrl) { culture.push(a); return false; }
      return true;
    });
    const gridPool = culture.length === 3 ? remaining : afterStatement;

    const rows = chunk(gridPool, 4);
    return { cover, featured, statement, culture, rows };
  }, [articles]);

  if (!cover) return null;

  /* The ad band lands after the second grid row — mid-page on a normal
     day — falling back to after-the-last-row / after-featured when the
     day is light. */
  const adAfterRow = rows.length === 0 ? -1 : Math.min(1, rows.length - 1);

  return (
    <main className="gv-feed">
      <ScrollProgress />
      <CoverModule a={cover} onOpen={() => onOpen(cover)} />

      {featured.length > 0 && (
        <Reveal className="gv-block">
          <div className="gv-feature">
            {featured.map((a) => (
              <div key={a.id} className="gv-feature__slot">
                <StoryCard a={a} onOpen={() => onOpen(a)} size="feature" treat="framed" />
              </div>
            ))}
          </div>
        </Reveal>
      )}

      {rows.length === 0 && statement && (
        <StatementModule a={statement} onOpen={() => onOpen(statement!)} />
      )}

      {adAfterRow === -1 && <AppAdBand />}
      {adAfterRow === -1 && culture.length === 3 && (
        <CultureSection items={culture} onOpen={onOpen} />
      )}

      {rows.length > 0 && (
        <div className="gv-block gv-gridblock">
          <div className="gv-div">
            <span className="gv-div__label">Editor's Picks</span>
            <span className="gv-div__rule" />
          </div>
          {rows.map((row, ri) => (
            <div key={`r-${ri}`}>
              <Reveal className="gv-rowsp">
                <div className="gv-three">
                  {row.map((a, ci) => (
                    <div key={a.id} className="gv-three__slot">
                      <StoryCard
                        a={a}
                        onOpen={() => onOpen(a)}
                        size="std"
                        treat={TREAT_CYCLE[(ri * PER_ROW + ci) % TREAT_CYCLE.length]}
                      />
                    </div>
                  ))}
                </div>
              </Reveal>
              {ri === 0 && statement && <StatementModule a={statement} onOpen={() => onOpen(statement!)} />}
              {ri === adAfterRow && <AppAdBand />}
              {ri === adAfterRow && culture.length === 3 && (
                <CultureSection items={culture} onOpen={onOpen} />
              )}
            </div>
          ))}
        </div>
      )}

      <ClosingBand />
      <style>{GRID_CSS}</style>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
const GRID_CSS = `
  .gv-feed {
    max-width: ${MAX_W}px;
    margin: 0 auto;
    padding: 44px 48px 76px;
  }
  .gv-feed a { -webkit-tap-highlight-color: transparent; }

  /* Reveal */
  .gv-rv { opacity: 0; transform: translateY(18px);
    transition: opacity .7s ease, transform .8s cubic-bezier(.16,.84,.3,1); }
  .gv-rv.is-in { opacity: 1; transform: none; }

  @media (prefers-reduced-motion: reduce) {
    .gv-rv { opacity: 1; transform: none; transition: none; }
    .gv-rv .gv-img img { transform: scale(1.012); transition: none; }
  }

  /* Reading-progress hairline — pinned to the very top of the window. */
  .gv-progress { position: fixed; top: 0; left: 0; right: 0; height: 2px;
    background: ${BLUE}; transform-origin: 0 50%; transform: scaleX(0);
    z-index: 1000; will-change: transform; }

  /* Block rhythm — every major block opens with a hairline. */
  .gv-block { margin-top: 64px; border-top: 1px solid ${HAIR}; padding-top: 40px; }
  .gv-gridblock, .gv-culture { border-top: none; padding-top: 0; }
  .gv-gridblock > div + div .gv-rowsp { margin-top: 60px; }

  /* Atoms */
  .gv-kicker { display: inline-flex; align-items: center; gap: 8px;
    font-family: ${MONO}; font-size: 10px; font-weight: 500;
    letter-spacing: .24em; text-transform: uppercase; color: ${BLUE}; }
  .gv-kicker__sq { width: 6px; height: 6px; background: ${BLUE}; display: inline-block; }
  .gv-kicker.is-light { color: ${CREAM}; }
  .gv-kicker.is-light .gv-kicker__sq { background: ${CREAM}; }

  .gv-img { position: relative; overflow: hidden; background: #ececea; }
  .gv-img img { position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; transform: scale(1.012);
    transition: transform 1.3s cubic-bezier(.16,.84,.3,1); }
  .gv-card:hover .gv-img img,
  .gv-cover:hover .gv-cover__img img { transform: scale(1.05); }

  /* Reveal settle — the photo eases out of a soft zoom as its block
     scrolls in (a quiet editorial "focus pull"); no overlays, no colour
     wash. Framed/mat keep their own still photo + frame-lift instead. */
  .gv-rv .gv-img img { transform: scale(1.07); }
  .gv-rv.is-in .gv-img img { transform: scale(1.012); }

  .gv-meta { display: flex; align-items: center; gap: 12px; margin-top: 13px; }
  .gv-meta__cat { font-family: ${MONO}; font-size: 9.5px; font-weight: 500;
    letter-spacing: .24em; text-transform: uppercase; color: ${BLUE}; white-space: nowrap; }
  .gv-meta__rule { flex: 1; height: 1px; background: ${HAIR}; }
  .gv-meta__arr { font-family: ${MONO}; font-size: 11px; color: ${INK};
    transition: transform .35s cubic-bezier(.2,.7,.2,1), color .35s ease; }
  .gv-card:hover .gv-meta__arr { transform: translate(3px,-3px); color: ${BLUE}; }

  /* Headlines — ink-black always. Higher-contrast didone cut: heavier
     weight, tighter leading, a hair of negative tracking, and a thin
     ink underline that sweeps in on hover (drawn as a sized gradient so
     it animates without reflow). */
  .gv-title { display: block; margin: 9px 0 0; padding-bottom: 3px;
    font-family: ${DISPLAY}; font-weight: 700;
    font-variation-settings: "opsz" 36;
    font-size: clamp(15px, 1.15vw, 18px); line-height: 1.18;
    letter-spacing: -0.014em; color: ${INK};
    background-image: linear-gradient(${INK}, ${INK});
    background-size: 0% 1.5px; background-position: 0 100%; background-repeat: no-repeat;
    transition: background-size .5s cubic-bezier(.2,.7,.2,1); }
  .gv-card:hover .gv-title { background-size: 100% 1.5px; }
  .gv-card--feature .gv-title { font-size: clamp(20px, 1.7vw, 27px); line-height: 1.08;
    font-variation-settings: "opsz" 72; letter-spacing: -0.018em; }
  .gv-dek { margin: 11px 0 0; font-family: ${DEK}; font-style: italic;
    font-size: 14px; line-height: 1.5; color: ${MUTE}; max-width: 56ch;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

  /* Functional byline — source + read time, real metadata. */
  .gv-foot { display: flex; align-items: center; gap: 8px; margin-top: 11px;
    font-family: ${MONO}; font-size: 9px; font-weight: 500;
    letter-spacing: .2em; text-transform: uppercase; color: ${MUTE}; }
  .gv-foot__src { color: ${INK}; white-space: nowrap; overflow: hidden;
    text-overflow: ellipsis; max-width: 60%; }
  .gv-foot__dot { width: 3px; height: 3px; border-radius: 50%; background: ${MUTE};
    flex: 0 0 auto; }
  .gv-foot__rt { white-space: nowrap; }
  .gv-foot.is-light { color: rgba(255,255,255,0.7); }
  .gv-foot.is-light .gv-foot__src { color: ${CREAM}; }
  .gv-foot.is-light .gv-foot__dot { background: rgba(255,255,255,0.6); }

  .gv-readcue { display: inline-flex; align-items: center; gap: 8px;
    margin-top: 20px; font-family: ${MONO}; font-size: 10px; font-weight: 500;
    letter-spacing: .24em; text-transform: uppercase; color: ${INK};
    border-bottom: 1px solid ${INK}; padding-bottom: 4px;
    transition: color .3s ease, border-color .3s ease; }
  .gv-readcue i { font-style: normal; transition: transform .35s cubic-bezier(.2,.7,.2,1); }
  a:hover .gv-readcue { color: ${BLUE}; border-color: ${BLUE}; }
  a:hover .gv-readcue i { transform: translateX(4px); }

  .gv-card { display: block; text-decoration: none; color: inherit; cursor: pointer; }

  /* ── Image treatments — borrowed from the drag rail ────────────── */
  /* pop / pop2 — a hard, blur-less offset block down-right of the
     photo; it tightens toward the photo on hover. Extra foot clearance
     so the block never rides over the meta line. */
  .gv-card--t-pop  .gv-img { box-shadow: 8px 8px 0 ${CREAM};
    transition: box-shadow .4s cubic-bezier(.2,.7,.2,1); }
  .gv-card--t-pop2 .gv-img { box-shadow: 8px 8px 0 ${BLUE};
    transition: box-shadow .4s cubic-bezier(.2,.7,.2,1); }
  .gv-card--t-pop:hover  .gv-img { box-shadow: 4px 4px 0 ${CREAM}; }
  .gv-card--t-pop2:hover .gv-img { box-shadow: 4px 4px 0 ${BLUE}; }
  .gv-card--t-pop .gv-meta, .gv-card--t-pop2 .gv-meta { margin-top: 16px; }

  /* edge — a flush hairline frame drawn over the photo; on hover the line
     thickens to signature blue. Minimal, Elephant-style. */
  .gv-card--t-edge .gv-img::after { content: ""; position: absolute; inset: 0; z-index: 2;
    box-shadow: inset 0 0 0 1px rgba(10,10,10,0.55); pointer-events: none;
    transition: box-shadow .35s ease; }
  .gv-card--t-edge:hover .gv-img::after { box-shadow: inset 0 0 0 2px ${BLUE}; }

  /* framed — hung like a gallery piece: thin ink line, a breathing gap
     to the photo, soft cast shadow. The frame lifts on hover instead of
     the photo zooming. */
  .gv-card--t-framed .gv-img { box-sizing: border-box; background: transparent;
    padding: clamp(6px, 0.55vw, 9px); border: 1.25px solid ${INK};
    box-shadow: 0 22px 38px -26px rgba(20,18,16,0.5);
    transition: transform .45s cubic-bezier(.2,.7,.2,1), box-shadow .45s ease; }
  /* static (not absolute) so the photo respects the mat/frame padding */
  .gv-card--t-framed .gv-img img,
  .gv-card--t-mat .gv-img img { position: static; width: 100%; height: 100%; }
  .gv-card--t-framed .gv-img img { transform: none; border: 1px solid rgba(10,10,10,0.2);
    box-sizing: border-box; }
  .gv-card--t-framed:hover .gv-img { transform: translateY(-5px);
    box-shadow: 0 30px 46px -26px rgba(20,18,16,0.55); }
  .gv-card--t-framed:hover .gv-img img { transform: none; }

  /* mat — a polaroid mat: white border all round, a touch deeper at the
     foot, resting on a soft shadow. */
  .gv-card--t-mat .gv-img { box-sizing: border-box; background: #fff;
    padding: 9px 9px 26px;
    box-shadow: 0 1px 0 rgba(10,10,10,0.12), 0 16px 30px -20px rgba(20,18,16,0.45);
    transition: transform .45s cubic-bezier(.2,.7,.2,1), box-shadow .45s ease; }
  .gv-card--t-mat:hover .gv-img { transform: translateY(-4px);
    box-shadow: 0 1px 0 rgba(10,10,10,0.12), 0 24px 38px -22px rgba(20,18,16,0.5); }
  .gv-card--t-mat .gv-img img { transform: none; }
  .gv-card--t-mat:hover .gv-img img { transform: none; }

  /* overlay — the headline lives inside the photo, white on a shade. */
  .gv-card--overlay .gv-overlay__img { aspect-ratio: 3/2; }
  .gv-overlay__shade { position: absolute; inset: 0; z-index: 1;
    background: linear-gradient(to top, rgba(4,8,20,0.82) 0%, rgba(4,8,20,0.34) 38%, rgba(4,8,20,0) 64%); }
  .gv-overlay__txt { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2;
    padding: 22px 24px; }
  .gv-overlay__cat { font-family: ${MONO}; font-size: 9.5px; font-weight: 500;
    letter-spacing: .24em; text-transform: uppercase; color: ${CREAM}; }
  .gv-overlay__title { margin: 9px 0 0; font-family: ${DISPLAY}; font-weight: 600;
    font-variation-settings: "opsz" 72;
    font-size: clamp(19px, 1.6vw, 25px); line-height: 1.12;
    letter-spacing: -0.01em; color: #fff; max-width: 30ch; }
  .gv-overlay__bottom { display: flex; align-items: flex-end; justify-content: space-between;
    gap: 16px; margin-top: 14px; }
  .gv-overlay__bottom .gv-foot { margin-top: 0; }
  .gv-overlay__cue { display: inline-flex; align-items: center; gap: 7px;
    font-family: ${MONO}; font-size: 9.5px; font-weight: 500;
    letter-spacing: .24em; text-transform: uppercase; color: rgba(255,255,255,0.85);
    border-bottom: 1px solid rgba(255,255,255,0.5); padding-bottom: 3px;
    transition: color .3s ease, border-color .3s ease; }
  .gv-overlay__cue i { font-style: normal; transition: transform .35s cubic-bezier(.2,.7,.2,1); }
  .gv-card--overlay:hover .gv-overlay__cue { color: #fff; border-color: #fff; }
  .gv-card--overlay:hover .gv-overlay__cue i { transform: translateX(4px); }

  /* ── Cover ─────────────────────────────────────────────────────── */
  .gv-cover { display: grid; grid-template-columns: repeat(12, 1fr);
    column-gap: 32px; align-items: end; text-decoration: none; color: inherit; }
  .gv-cover__txt { grid-column: 1 / span 6; max-width: 90%; padding-bottom: 52px; }
  .gv-cover__title { margin: 20px 0 0; font-family: ${DISPLAY}; font-weight: 650;
    font-variation-settings: "opsz" 96;
    font-size: clamp(28px, 2.9vw, 46px); line-height: 1.04;
    letter-spacing: -0.018em; color: ${INK}; }
  .gv-cover__dek { margin: 16px 0 0; font-family: ${DEK}; font-style: italic;
    font-size: 15px; line-height: 1.55; color: ${MUTE}; }
  .gv-cover__foot { display: flex; align-items: center; gap: 22px; flex-wrap: wrap;
    margin-top: 24px; }
  .gv-cover__foot .gv-foot, .gv-cover__foot .gv-readcue { margin-top: 0; }
  .gv-cover__imgwrap { grid-column: 7 / -1; position: relative; }
  .gv-cover__block { position: absolute; inset: 0;
    transform: translate(12px, 12px); background: ${BLUE};
    transition: transform .45s cubic-bezier(.2,.7,.2,1); }
  .gv-cover:hover .gv-cover__block { transform: translate(17px, 17px); }
  .gv-cover__img { aspect-ratio: 3/2; }
  .gv-cover--text { display: block; max-width: 820px; margin: 0 auto;
    text-align: center; padding: 40px 0 10px; }
  .gv-cover--text .gv-cover__dek { margin-left: auto; margin-right: auto; }

  /* ── Featured pair — equal halves, ruled column between ───────── */
  .gv-feature { display: grid; grid-template-columns: 1fr 1fr; }
  .gv-feature__slot { padding: 0 30px; }
  .gv-feature__slot:first-child { padding-left: 0; }
  .gv-feature__slot:last-child { padding-right: 0; }
  .gv-feature__slot + .gv-feature__slot { border-left: 1px solid ${HAIR}; }
  .gv-feature__slot:only-child { grid-column: 1 / -1; padding: 0; }
  .gv-feature__slot:only-child .gv-img { aspect-ratio: 21/9; }

  /* ── Divider label ─────────────────────────────────────────────── */
  .gv-div { display: flex; align-items: center; gap: 16px; margin-bottom: 40px; }
  .gv-div__label { font-family: ${MONO}; font-size: 10px; font-weight: 500;
    letter-spacing: .26em; text-transform: uppercase; color: ${INK}; white-space: nowrap; }
  .gv-div__rule { flex: 1; height: 1px; background: ${HAIR}; }

  /* ── Uniform rows of four, ruled columns ───────────────────────── */
  .gv-three { display: grid; grid-template-columns: repeat(4, 1fr); }
  .gv-three__slot { padding: 0 22px; }
  .gv-three__slot:first-child { padding-left: 0; }
  .gv-three__slot:last-child { padding-right: 0; }
  .gv-three__slot + .gv-three__slot { border-left: 1px solid ${HAIR}; }

  /* ── Text (image-less) card — same footprint as an image card ──── */
  .gv-card--text__box { position: relative; display: flex; flex-direction: column;
    justify-content: space-between; background: ${CREAM};
    padding: 18px; box-shadow: inset 0 0 0 1px rgba(10,10,10,0.08);
    transition: background .4s ease; }
  .gv-card--text:hover .gv-card--text__box { background: #ece2cb; }
  .gv-card--text__cat { font-family: ${MONO}; font-size: 9.5px; font-weight: 500;
    letter-spacing: .24em; text-transform: uppercase; color: ${BLUE}; }
  .gv-card--text__title { margin: 0; font-family: ${DISPLAY};
    font-weight: 600; font-variation-settings: "opsz" 60;
    font-size: clamp(16px, 1.3vw, 20px); line-height: 1.2;
    letter-spacing: -0.01em; color: ${INK};
    display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
  .gv-card--text__cue { font-family: ${MONO}; font-size: 10px;
    letter-spacing: .24em; text-transform: uppercase; color: ${INK};
    transition: color .3s ease; }
  .gv-card--text__cue i { font-style: normal; }
  .gv-card--text:hover .gv-card--text__cue { color: ${BLUE}; }

  /* ── Statement — the day's big artistic frame ──────────────────── */
  .gv-statementwrap { margin-top: 60px; }
  .gv-statement { display: block; }
  .gv-statement__img { aspect-ratio: 2.15 / 1; }
  .gv-statement__img::after { content: ""; position: absolute; inset: 0;
    box-shadow: inset 0 0 0 1px rgba(10,10,10,0.16); pointer-events: none; z-index: 2; }
  .gv-statement__tag { position: absolute; left: 0; top: 0; z-index: 3;
    background: ${BLUE}; color: ${CREAM}; font-family: ${MONO}; font-size: 9.5px;
    font-weight: 500; letter-spacing: .24em; text-transform: uppercase;
    padding: 9px 16px; }
  .gv-statement__txt { display: grid; grid-template-columns: 1.5fr 1fr;
    column-gap: 48px; align-items: end; margin-top: 26px; }
  .gv-statement__cat { font-family: ${MONO}; font-size: 10px; font-weight: 500;
    letter-spacing: .24em; text-transform: uppercase; color: ${BLUE}; }
  .gv-statement__title { margin: 14px 0 0; font-family: ${DISPLAY}; font-weight: 700;
    font-variation-settings: "opsz" 96;
    font-size: clamp(30px, 3.6vw, 54px); line-height: 1.02;
    letter-spacing: -0.02em; color: ${INK};
    background-image: linear-gradient(${INK}, ${INK});
    background-size: 0% 2px; background-position: 0 100%; background-repeat: no-repeat;
    transition: background-size .55s cubic-bezier(.2,.7,.2,1); padding-bottom: 4px; }
  .gv-statement:hover .gv-statement__title { background-size: 100% 2px; }
  .gv-statement__side { padding-bottom: 6px; }
  .gv-statement__dek { margin: 0; font-family: ${DEK}; font-style: italic;
    font-size: 16px; line-height: 1.55; color: ${MUTE}; }
  .gv-statement__foot { display: flex; align-items: center; gap: 22px;
    flex-wrap: wrap; margin-top: 20px; }
  .gv-statement__foot .gv-foot, .gv-statement__foot .gv-readcue { margin-top: 0; }

  /* ── App-ad band ───────────────────────────────────────────────── */
  .gv-adwrap { margin-top: 64px; }
  .gv-gridblock .gv-adwrap { margin-top: 60px; }
  .gv-ad { position: relative; isolation: isolate; overflow: hidden;
    background: ${BLUE}; color: #fff;
    display: grid; grid-template-columns: 1.1fr 1fr; align-items: center;
    min-height: 330px; }
  .gv-ad__grain { position: absolute; inset: 0; opacity: .5;
    mix-blend-mode: overlay; pointer-events: none; z-index: 0; }
  .gv-ad__txt { position: relative; z-index: 1; padding: 48px 24px 48px 52px; }
  .gv-ad__title { margin: 18px 0 0; font-family: ${DISPLAY}; font-weight: 600;
    font-variation-settings: "opsz" 96;
    font-size: clamp(26px, 2.4vw, 38px); line-height: 1.04;
    letter-spacing: -0.014em; color: #fff; }
  .gv-ad__title em { font-style: italic; color: ${CREAM}; }
  .gv-ad__sub { margin: 14px 0 0; font-family: ${DEK}; font-style: italic;
    font-size: 14.5px; line-height: 1.5; color: rgba(255,241,205,0.78); max-width: 40ch; }
  .gv-ad__btn { display: inline-flex; align-items: center; gap: 9px;
    margin-top: 24px; padding: 11px 18px; background: ${CREAM}; color: ${BLUE};
    font-family: ${MONO}; font-size: 10.5px; font-weight: 500;
    letter-spacing: .22em; text-transform: uppercase; text-decoration: none;
    transition: background .3s ease, color .3s ease, transform .3s ease; }
  .gv-ad__btn i { font-style: normal; transition: transform .35s cubic-bezier(.2,.7,.2,1); }
  .gv-ad__btn:hover { background: #fff; transform: translateY(-2px); }
  .gv-ad__btn:hover i { transform: translateX(4px); }
  .gv-ad__stage { position: relative; z-index: 1; height: 100%; min-height: 330px; }
  .gv-ad__block { position: absolute; top: 50%; left: 50%; width: min(52%, 232px);
    aspect-ratio: 4/5; transform: translate(calc(-50% + 12px), calc(-50% + 12px));
    background: ${CREAM};
    transition: transform .45s cubic-bezier(.2,.7,.2,1); }
  .gv-ad:hover .gv-ad__block { transform: translate(calc(-50% + 17px), calc(-50% + 17px)); }
  .gv-ad__frame { position: absolute; top: 50%; left: 50%; width: min(52%, 232px);
    aspect-ratio: 4/5; transform: translate(-50%, -50%);
    overflow: hidden; background: #02123c; }
  .gv-ad__frame img { position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; opacity: 0; }
  .gv-ad__frame img.is-on { opacity: 1; }

  /* ── Culture — photographs "pinned" like prints on a table (Marfa
     Journal): unequal sizes, staggered drops, a slight hand rotation that
     straightens on hover, thin print mats, mono index + italic caption. */
  .gv-culture__snaps { display: flex; justify-content: center;
    align-items: flex-start; gap: clamp(20px, 2.8vw, 44px);
    flex-wrap: wrap; padding: 10px 0 28px; }
  .gv-snap { display: block;
    transition: transform .55s cubic-bezier(.16,.84,.3,1); }
  .gv-snap--a { width: clamp(206px, 21vw, 290px); margin-top: 34px; transform: rotate(-1.5deg); }
  .gv-snap--b { width: clamp(236px, 24vw, 326px); margin-top: 96px; transform: rotate(1.1deg); }
  .gv-snap--c { width: clamp(222px, 22.5vw, 308px); margin-top: 0; transform: rotate(-0.6deg); }
  .gv-snap--d { width: clamp(212px, 21.5vw, 298px); margin-top: 58px; transform: rotate(1.4deg); }
  .gv-snap:hover { transform: rotate(0deg) translateY(-5px); }
  .gv-snap--poster { cursor: default; }
  .gv-snap--poster:hover .gv-snap__img img { transform: scale(1.04); }

  /* The print — a slim white mat with a hairline frame and a soft cast. */
  .gv-snap__print { background: #fff; padding: 9px;
    border: 1px solid rgba(10,10,10,0.18);
    box-shadow: 0 16px 36px rgba(10,10,10,0.10);
    transition: box-shadow .45s ease; }
  .gv-snap:hover .gv-snap__print { box-shadow: 0 24px 50px rgba(10,10,10,0.16); }
  .gv-snap__img { width: 100%; background: #ececea; }
  .gv-snap--a .gv-snap__img { aspect-ratio: 4 / 5; }
  .gv-snap--b .gv-snap__img { aspect-ratio: 1 / 1; }
  .gv-snap--c .gv-snap__img { aspect-ratio: 3 / 4; }
  .gv-snap--d .gv-snap__img { aspect-ratio: 4 / 5; }

  .gv-snap__idx { display: block; margin-top: 15px; font-family: ${MONO};
    font-size: 10px; font-weight: 500; letter-spacing: .22em;
    text-transform: uppercase; color: ${MUTE}; }
  .gv-snap__title { margin: 8px 0 0; font-family: ${DISPLAY}; font-weight: 700;
    font-variation-settings: "opsz" 36;
    font-size: clamp(17px, 1.35vw, 21px); line-height: 1.16;
    letter-spacing: -0.014em; color: ${INK};
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .gv-snap:hover .gv-snap__title { color: ${BLUE}; }

  /* ── Closing band — IG + sign-off ──────────────────────────────── */
  .gv-closewrap { margin-top: 72px; }
  .gv-close { border-top: 1px solid ${HAIR}; padding-top: 64px;
    display: grid; grid-template-columns: repeat(12, 1fr);
    column-gap: 32px; align-items: center; }
  .gv-ig { grid-column: 1 / span 5; position: relative; isolation: isolate;
    overflow: hidden; display: flex; flex-direction: column;
    justify-content: space-between; gap: 28px;
    background: ${BLUE}; color: #fff; text-decoration: none;
    padding: 22px; min-height: 224px;
    transition: filter .35s ease; }
  .gv-ig:hover { filter: brightness(1.08); }
  .gv-ig__grain { position: absolute; inset: 0; opacity: .5;
    mix-blend-mode: overlay; pointer-events: none; z-index: 0; }
  .gv-ig__head { position: relative; z-index: 1; display: flex; align-items: center;
    gap: 9px; font-family: ${MONO}; font-size: 10px; font-weight: 500;
    letter-spacing: .24em; text-transform: uppercase; color: rgba(255,241,205,0.85); }
  .gv-ig__mid { position: relative; z-index: 1; display: flex; align-items: center; gap: 20px; }
  .gv-ig__logo { width: 72px; height: 72px; flex: 0 0 auto; background: ${CREAM};
    border-radius: 15px; overflow: hidden; display: flex; align-items: center;
    justify-content: center; box-shadow: 0 10px 26px rgba(0,0,0,0.25); }
  .gv-ig__logo img { width: 100%; height: 100%; object-fit: contain; padding: 8%; }
  .gv-ig__handle { font-family: ${DISPLAY}; font-style: italic; font-weight: 560;
    font-variation-settings: "opsz" 40;
    font-size: clamp(19px, 1.5vw, 24px); letter-spacing: -0.01em; color: #fff; }
  .gv-ig__cue { position: relative; z-index: 1; align-self: flex-end;
    font-family: ${MONO}; font-size: 10.5px; letter-spacing: .24em;
    text-transform: uppercase; color: ${CREAM}; }
  .gv-ig__cue i { font-style: normal; }
  .gv-close__note { grid-column: 7 / -1; text-align: right; }
  .gv-close__line { margin: 0; font-family: ${DISPLAY}; font-weight: 600;
    font-variation-settings: "opsz" 96;
    font-size: clamp(28px, 2.6vw, 42px); line-height: 1.04;
    letter-spacing: -0.016em; color: ${INK}; }
  .gv-close__line em { font-style: italic; color: ${BLUE}; }
  .gv-close__sub { display: inline-block; margin-top: 14px;
    font-family: ${MONO}; font-size: 10px; font-weight: 500;
    letter-spacing: .26em; text-transform: uppercase; color: ${MUTE}; }

  /* ── Responsive ────────────────────────────────────────────────── */
  @media (max-width: 1180px) {
    .gv-feed { padding: 40px 36px 68px; }
    .gv-block { margin-top: 56px; padding-top: 36px; }
    .gv-cover__txt { grid-column: 1 / span 6; }
    .gv-cover__imgwrap { grid-column: 7 / -1; }
    .gv-feature__slot { padding: 0 22px; }
    .gv-three__slot { padding: 0 16px; }
  }
  @media (max-width: 860px) {
    .gv-cover { row-gap: 36px; }
    .gv-cover__txt { grid-column: 1 / -1; order: 2; padding-bottom: 0; }
    .gv-cover__imgwrap { grid-column: 1 / -1; order: 1; }
    .gv-feature { grid-template-columns: 1fr; row-gap: 48px; }
    .gv-feature__slot { padding: 0; border-left: none !important; }
    .gv-three { grid-template-columns: 1fr 1fr; row-gap: 44px; }
    .gv-three__slot { padding: 0 14px; }
    .gv-three__slot:nth-child(odd) { padding-left: 0; }
    .gv-three__slot:nth-child(even) { padding-right: 0; }
    .gv-three__slot:nth-child(2n+1) { border-left: none; }
    .gv-statement__img { aspect-ratio: 16 / 10; }
    .gv-statement__txt { grid-template-columns: 1fr; row-gap: 18px; }
    .gv-statement__side { padding-bottom: 0; }
    .gv-ad { grid-template-columns: 1fr; }
    .gv-ad__txt { padding: 44px 36px 20px; }
    .gv-ad__stage { min-height: 300px; }
    .gv-culture__snaps { gap: 36px 28px; }
    .gv-snap--a, .gv-snap--b, .gv-snap--c, .gv-snap--d { margin-top: 0; transform: none;
      width: min(80vw, 320px); }
    .gv-snap:hover { transform: translateY(-5px); }
    .gv-close { row-gap: 48px; }
    .gv-ig { grid-column: 1 / -1; }
    .gv-close__note { grid-column: 1 / -1; text-align: left; }
  }
`;
