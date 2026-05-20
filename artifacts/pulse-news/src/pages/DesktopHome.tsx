import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Check } from "lucide-react";
import { format, startOfDay, isSameDay } from "date-fns";
import type { NewsArticle } from "@workspace/api-client-react";
import { useInfiniteNewsFeed } from "@/hooks/use-news";
import { useAuth } from "@/hooks/use-auth";
import { SavesContext, useSavesRoot } from "@/hooks/use-saves";
import { feedImageUrl } from "@/lib/image-url";
import { ArticleReader } from "@/components/ArticleReader";
import { DesktopAuthModal } from "@/components/desktop/DesktopAuthModal";
import { SignUpFlow } from "@/components/SignUpFlow";
import { SignInSheet } from "@/components/SignInSheet";
import { GrainBackground } from "@/components/GrainBackground";

/* ─────────────────────────────────────────────────────────────────────
   Popcorn — Desktop Web Layout
   Editorial publication style. Cream paper canvas, blue serif body.
   Macabro masthead. Newsreader serif headlines. Asymmetric hero + grid.

   Only rendered when useIsDesktopWeb() === true (viewport ≥ 1024px AND
   not Capacitor / installed PWA). Mobile + native code paths untouched.
   ─────────────────────────────────────────────────────────────────────
*/

const BLUE = "#053980";
const BLUE_DEEP = "#031f48";
const CREAM = "#FDF1E0";
const CREAM_SOFT = "#F6E7D0";
const PAPER = "#FDF1E0";
const INK = "#0a2a5a";
const POP_YELLOW = "#F5C463";
const ACCENT_RED = "#E0492C";

/* Category pill colours — desktop version uses muted blue tint over cream,
   relying on small uppercase Macabro tracking for the editorial signature
   rather than vivid hue swatches that would clash with the paper aesthetic. */
const CATEGORY_LABEL: Record<string, string> = {
  "Sports": "Sport",
  "Culture": "Culture",
  "Fashion": "Fashion",
  "Internet": "Internet",
  "Gaming": "Gaming",
  "World": "World",
  "Science": "Science",
  "Tech": "Tech",
  "Film & TV": "Film & TV",
  "AI": "AI",
  "Books": "Books",
  "Music": "Music",
  "Industry": "Industry",
};

// Canonical category order — drives the filter pill nav. "All" is rendered
// separately as the lead pill.
const ALL_CATEGORIES = [
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

type DayGroup = {
  date: Date;
  id: string;
  articles: NewsArticle[];
};

function groupByDay(articles: NewsArticle[]): DayGroup[] {
  // Bucket every article into its day. Use `feedDate` (Popcorn's editorial
  // day, set at curation time) when present, otherwise fall back to the
  // start-of-day of publishedAt. A Map keeps the grouping order-independent
  // so out-of-order pagination doesn't split a single day across multiple
  // rows.
  const buckets = new Map<number, DayGroup>();
  for (const a of articles) {
    const ref = a.feedDate ? new Date(`${a.feedDate}T00:00:00`) : new Date(a.publishedAt);
    const d = startOfDay(ref);
    const key = d.getTime();
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { date: d, id: `day-${key}`, articles: [] };
      buckets.set(key, bucket);
    }
    bucket.articles.push(a);
  }
  // Sort buckets newest → oldest. Within each bucket, preserve the API's
  // ordering (it already ranks the lead story first).
  return Array.from(buckets.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function DesktopHome() {
  const { user, signOut } = useAuth();
  const saves = useSavesRoot(user);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteNewsFeed();

  // The mobile feed locks html/body/#root to `overflow: hidden` (each
  // day-card is its own internal scroll container). Desktop needs the
  // page to scroll naturally — toggle the lock for the lifetime of this
  // component, then restore on unmount so mobile-feed behaviour isn't
  // perturbed when the user resizes the window narrower.
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const targets: Array<HTMLElement | null> = [html, body, root];
    const prev = targets.map((el) =>
      el ? { overflow: el.style.overflow, height: el.style.height } : null,
    );
    targets.forEach((el) => {
      if (!el) return;
      el.style.overflow = "visible";
      el.style.height = "auto";
    });
    return () => {
      targets.forEach((el, i) => {
        const p = prev[i];
        if (!el || !p) return;
        el.style.overflow = p.overflow;
        el.style.height = p.height;
      });
    };
  }, []);

  // Auth popup — appears once per session for signed-out visitors,
  // dismissible. Persists dismissal in sessionStorage so it doesn't
  // re-trigger on hot-reload.
  const [authOpen, setAuthOpen] = useState(false);
  useEffect(() => {
    if (user) return;
    if (sessionStorage.getItem("popcorn_desktop_auth_dismissed")) return;
    // Delay slightly so the first paint lands before the modal slides in.
    const t = setTimeout(() => setAuthOpen(true), 1200);
    return () => clearTimeout(t);
  }, [user]);

  // Manual sign-in/sign-up sheets (reused from mobile; positioned as
  // bottom sheets which still read fine when invoked occasionally on
  // desktop — they live above everything).
  const [signUpOpen, setSignUpOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  const closeAuth = useCallback(() => {
    sessionStorage.setItem("popcorn_desktop_auth_dismissed", "1");
    setAuthOpen(false);
  }, []);

  const [readingArticle, setReadingArticle] = useState<NewsArticle | null>(null);

  // Category filter (null = "All"). Setting this scrolls back to top so
  // the topic view starts at its hero, not deep in the previous scroll
  // position.
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const selectCategory = useCallback((c: string | null) => {
    setSelectedCategory(c);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const allArticles = useMemo(() => {
    return data?.pages.flatMap((p) => p.articles) ?? [];
  }, [data]);

  const filteredArticles = useMemo(() => {
    if (!selectedCategory) return allArticles;
    return allArticles.filter((a) => a.category === selectedCategory);
  }, [allArticles, selectedCategory]);

  const days = useMemo(() => groupByDay(filteredArticles), [filteredArticles]);
  const today = days[0];

  // Infinite scroll: load more when within 1200px of the bottom.
  useEffect(() => {
    const onScroll = () => {
      if (!hasNextPage || isFetchingNextPage) return;
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 1200;
      if (nearBottom) fetchNextPage();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // When a topic filter is active, the filtered list may be too short to
  // overflow the viewport — which means scroll never reaches the bottom
  // and infinite-scroll never fires. Keep auto-fetching until either the
  // page is tall enough to scroll OR there's nothing left.
  useEffect(() => {
    if (!selectedCategory) return;
    if (!hasNextPage || isFetchingNextPage) return;
    const scrollable =
      document.documentElement.scrollHeight > window.innerHeight + 200;
    if (!scrollable) fetchNextPage();
  }, [selectedCategory, filteredArticles.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
   <SavesContext.Provider value={saves}>
    <div
      className="min-h-screen w-full relative"
      style={{ color: INK }}
    >
      {/* Warm cream paper canvas — Popcorn brand cream #FDF1E0 with the
          same procedural grain used throughout the mobile app. Fixed so
          the grain doesn't scroll out from under the content. */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <GrainBackground variant="popcorn-cream" />
      </div>
      <div className="relative z-10">
      {/* ── Utility bar (blue strip) ───────────────────────────────── */}
      <UtilityBar
        user={user}
        signedInName={user?.user_metadata?.full_name ?? user?.email ?? null}
        onSignInClick={() => setAuthOpen(true)}
        onSignOutClick={async () => {
          await signOut();
        }}
      />

      {/* ── Masthead ────────────────────────────────────────────────── */}
      <DesktopMasthead
        user={user}
        signedInName={user?.user_metadata?.full_name ?? user?.email ?? null}
        onSignInClick={() => setAuthOpen(true)}
        onSignOutClick={async () => {
          await signOut();
        }}
      />

      {/* ── Category filter nav ─────────────────────────────────────── */}
      <CategoryNav
        selected={selectedCategory}
        onSelect={selectCategory}
      />

      {/* ── Topic header (only when filtered) ────────────────────────── */}
      {selectedCategory && (
        <TopicHeader
          category={selectedCategory}
          totalCount={filteredArticles.length}
          onBack={() => selectCategory(null)}
        />
      )}

      {/* ── Hero + horizontal-per-day rows ──────────────────────────── */}
      {isLoading ? (
        <LoadingState />
      ) : !today ? (
        <main className="max-w-[1320px] mx-auto px-10 pb-24">
          {selectedCategory && (
            <div className="py-32 text-center">
              <p
                style={{
                  fontFamily: "'Newsreader', serif",
                  fontStyle: "italic",
                  fontSize: "22px",
                  color: BLUE,
                  opacity: 0.7,
                }}
              >
                No {CATEGORY_LABEL[selectedCategory] ?? selectedCategory} stories yet — check back tomorrow.
              </p>
            </div>
          )}
        </main>
      ) : (
        <main className="max-w-[1320px] mx-auto px-10 pb-24">
          {/* Filtered (topic) view: clean day-by-day rows, no hero. */}
          {selectedCategory ? (
            days.map((day, idx) => (
              <section key={day.id} className={idx === 0 ? "" : "mt-16"}>
                <EditionRule
                  date={day.date}
                  count={day.articles.length}
                  isFirst={idx === 0}
                />
                <DayRow
                  articles={day.articles}
                  onOpen={(a) => setReadingArticle(a)}
                />
              </section>
            ))
          ) : (
            <>
              <EditionRule
                date={today.date}
                count={today.articles.length}
                isFirst
              />
              <HeroLead
                article={today.articles[0]}
                onOpen={() => setReadingArticle(today.articles[0])}
              />
              {today.articles.length > 1 && (
                <div className="mt-12">
                  <DayRow
                    label="More from today"
                    articles={today.articles.slice(1)}
                    onOpen={(a) => setReadingArticle(a)}
                  />
                </div>
              )}

              {days.slice(1).map((day) => (
                <section key={day.id} className="mt-20">
                  <EditionRule date={day.date} count={day.articles.length} />
                  <DayRow
                    articles={day.articles}
                    onOpen={(a) => setReadingArticle(a)}
                  />
                </section>
              ))}
            </>
          )}

          {/* Infinite scroll sentinel */}
          {(isFetchingNextPage || hasNextPage) && (
            <div className="mt-16 flex items-center justify-center text-xs uppercase tracking-[0.3em]" style={{ color: BLUE, opacity: 0.6 }}>
              {isFetchingNextPage ? "Loading more stories…" : "Scroll for more"}
            </div>
          )}
        </main>
      )}

      <DesktopFooter />

      {/* ── Auth popup overlay ──────────────────────────────────────── */}
      {authOpen && !user && (
        <DesktopAuthModal
          onClose={closeAuth}
          onSignInWithEmail={() => {
            closeAuth();
            setSignInOpen(true);
          }}
          onCreateAccount={() => {
            closeAuth();
            setSignUpOpen(true);
          }}
        />
      )}

      {signUpOpen && (
        <SignUpFlow
          isOpen={signUpOpen}
          onClose={() => setSignUpOpen(false)}
          onComplete={() => setSignUpOpen(false)}
          onSignInInstead={() => {
            setSignUpOpen(false);
            setSignInOpen(true);
          }}
        />
      )}
      {signInOpen && (
        <SignInSheet
          isOpen={signInOpen}
          onClose={() => setSignInOpen(false)}
          onSignUpInstead={() => {
            setSignInOpen(false);
            setSignUpOpen(true);
          }}
        />
      )}

      {/* ── Article reader (reuses mobile component, which gracefully
            scales to wide viewports via its own internal constraints). ─ */}
      {readingArticle && (
        <ArticleReader
          article={readingArticle}
          onClose={() => setReadingArticle(null)}
        />
      )}
      </div>
    </div>
   </SavesContext.Provider>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Popcorn kernel — used as a brand bullet/middot replacement. Echoes
   the kernels spilling from the bucket in the masthead logo.
   ────────────────────────────────────────────────────────────────────── */

function PopcornKernel({
  size = 10,
  color = POP_YELLOW,
  tilt,
  className = "",
}: {
  size?: number;
  color?: string;
  tilt?: number;
  className?: string;
}) {
  // Trifoliate popcorn cluster — echoes the spilling popcorn in the logo.
  // The warm `color` underlay forms the kernel silhouette; cream lobes are
  // stacked on top at *varying* per-instance opacities so the warm tone
  // peeks through randomly — like the uneven cream-on-yellow texture of
  // real popcorn. A small per-instance tilt completes the loose, hand-drawn
  // feel.
  const dataRef = useRef<{
    tilt: number;
    lobeOpacities: [number, number, number];
    centreOpacity: number;
    speckles: Array<{ cx: number; cy: number; r: number; o: number }>;
  } | null>(null);
  if (dataRef.current === null) {
    const rand = (min: number, max: number) =>
      min + Math.random() * (max - min);
    dataRef.current = {
      tilt: tilt ?? (Math.random() - 0.5) * 56,
      lobeOpacities: [rand(0.55, 0.92), rand(0.55, 0.92), rand(0.55, 0.92)],
      centreOpacity: rand(0.4, 0.75),
      speckles: Array.from({ length: 3 }, () => ({
        cx: rand(6, 18),
        cy: rand(6, 17),
        r: rand(0.9, 1.6),
        o: rand(0.45, 0.85),
      })),
    };
  }
  const data = dataRef.current;
  const angle = tilt ?? data.tilt;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        transform: `rotate(${angle}deg)`,
      }}
    >
      {/* warm underlay — slightly larger lobes so a halo of `color` shows
          through at the edges and through the gaps between cream lobes. */}
      <g fill={color}>
        <circle cx="8" cy="9" r="6.2" />
        <circle cx="16" cy="9" r="6.2" />
        <circle cx="12" cy="16.2" r="6.2" />
      </g>
      {/* cream lobes, each at its own random opacity — gives the kernel
          an uneven cream-on-yellow texture where the warm tone shows
          through randomly, the way real popped corn looks. */}
      <g fill={CREAM}>
        <circle cx="8.5" cy="8.6" r="4.4" opacity={data.lobeOpacities[0]} />
        <circle cx="15.5" cy="8.6" r="4.4" opacity={data.lobeOpacities[1]} />
        <circle cx="12" cy="15.4" r="4.4" opacity={data.lobeOpacities[2]} />
        <circle cx="12" cy="11.2" r="2.6" opacity={data.centreOpacity} />
      </g>
      {/* small cream highlight speckles at varied opacity — the tiny
          bright spots you see on the logo's popcorn surface. */}
      <g fill={CREAM}>
        {data.speckles.map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} opacity={s.o} />
        ))}
      </g>
    </svg>
  );
}

function RegistrationMark({
  size = 14,
  color = INK,
  className = "",
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="0.8" />
      <path stroke={color} strokeWidth="0.8" d="M12 1v22M1 12h22" />
    </svg>
  );
}

function StarBurst({ size = 80, color = POP_YELLOW }: { size?: number; color?: string }) {
  const spikes = 16;
  const pts: string[] = [];
  const cx = 50, cy = 50, outer = 50, inner = 24;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / spikes;
    pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
  }
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <polygon points={pts.join(" ")} fill={color} />
    </svg>
  );
}

/* Scalloped wave — echoes the popcorn-bucket rim. Renders as a top edge
   on a coloured strip (the wave bites into the strip from above).
   When `cutout` is true, the SVG is transparent and the path fills the
   AREA ABOVE the wave with `bg` — meant to overlay a textured field so
   the bumps inherit the texture underneath. */
function ScallopDivider({
  color = BLUE,
  bg = CREAM,
  scallops = 36,
  height = 22,
  flip = false,
  cutout = false,
}: {
  color?: string;
  bg?: string;
  scallops?: number;
  height?: number;
  flip?: boolean;
  cutout?: boolean;
}) {
  const w = 1600;
  const r = w / scallops / 2;
  const totalH = height + 40;

  if (cutout) {
    // Cream cap that covers the area ABOVE the wave on a transparent SVG.
    // Bumps poke up from y=height into the cream area; valleys reach y=height.
    let d = `M 0 0 L ${w} 0 L ${w} ${height} `;
    for (let i = scallops - 1; i >= 0; i--) {
      const cx = i * r * 2 + r;
      d += `Q ${cx} ${height - r * 1.6} ${i * r * 2} ${height} `;
    }
    d += `L 0 0 Z`;
    return (
      <svg
        viewBox={`0 0 ${w} ${totalH}`}
        className="block w-full"
        style={{
          height: totalH,
          transform: flip ? "scaleY(-1)" : undefined,
        }}
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d={d} fill={bg} />
      </svg>
    );
  }

  let d = `M0 ${height} `;
  for (let i = 0; i < scallops; i++) {
    const cx = i * r * 2 + r;
    d += `Q ${cx} ${height - r * 1.6} ${cx + r} ${height} `;
  }
  d += `L ${w} ${totalH} L 0 ${totalH} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${totalH}`}
      className="block w-full"
      style={{
        height: totalH,
        transform: flip ? "scaleY(-1)" : undefined,
        background: bg,
      }}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={d} fill={color} />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Utility bar — textured blue strip at the very top with edition meta
   on the left (VOL · ISSUE · date · weather) and quick links on the
   right (archive · newsletter · download app · sign in pill).
   ────────────────────────────────────────────────────────────────────── */

function UtilityBar({
  user,
  signedInName,
  onSignInClick,
  onSignOutClick,
}: {
  user: any;
  signedInName: string | null;
  onSignInClick: () => void;
  onSignOutClick: () => void;
}) {
  const today = new Date();
  // Editorial issue number — counts days since launch (2025-12-01).
  const issueNumber = Math.max(
    1,
    Math.floor(
      (today.getTime() - new Date("2025-12-01T00:00:00").getTime()) / 86_400_000,
    ),
  );
  return (
    <div
      className="relative w-full"
      style={{ background: BLUE, color: CREAM, overflow: "hidden" }}
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <GrainBackground variant="popcorn-blue" />
      </div>
      <div
        className="relative max-w-[1320px] mx-auto px-10 py-2 flex items-center justify-between gap-6 flex-wrap"
        style={{
          fontFamily: "'Macabro', serif",
          fontSize: "10px",
          letterSpacing: "0.28em",
        }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span>{format(today, "EEEE · MMMM d, yyyy").toUpperCase()}</span>
          <span style={{ opacity: 0.45 }}>·</span>
          <span>BANGKOK</span>
        </div>
        <div className="flex items-center gap-5">
          <a
            href="#"
            className="hover:opacity-70 transition-opacity"
            style={{ color: CREAM }}
          >
            DOWNLOAD APP ↗
          </a>
          {user ? (
            <>
              <span style={{ opacity: 0.75 }}>
                {signedInName ? `HI, ${signedInName.split(" ")[0].toUpperCase()}` : "SIGNED IN"}
              </span>
              <button
                onClick={onSignOutClick}
                className="hover:opacity-70 transition-opacity"
                style={{
                  color: CREAM,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  letterSpacing: "0.28em",
                  fontFamily: "'Macabro', serif",
                  fontSize: "10px",
                  padding: 0,
                }}
              >
                SIGN OUT
              </button>
            </>
          ) : (
            <button
              onClick={onSignInClick}
              className="rounded-full transition-transform hover:scale-105"
              style={{
                background: CREAM,
                color: BLUE,
                fontFamily: "'Macabro', serif",
                fontSize: "10px",
                letterSpacing: "0.28em",
                padding: "3px 14px",
                border: "none",
                cursor: "pointer",
              }}
            >
              SIGN IN
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Masthead — full Popcorn wordmark with logo, tagline, and a kernel-dot
   rule below carrying the day's editorial metadata.
   ────────────────────────────────────────────────────────────────────── */

function DesktopMasthead({
  user: _user,
  signedInName: _signedInName,
  onSignInClick: _onSignInClick,
  onSignOutClick: _onSignOutClick,
}: {
  user: any;
  signedInName: string | null;
  onSignInClick: () => void;
  onSignOutClick: () => void;
}) {
  return (
    <header className="w-full">
      <div className="max-w-[1320px] mx-auto px-10 pt-9 pb-5">
        {/* Wordmark + side tagline */}
        <div className="flex items-end justify-between gap-8">
          <div className="flex items-end gap-4">
            <h1
              className="leading-none select-none"
              style={{
                fontFamily: "'Macabro', serif",
                fontSize: "clamp(28px, 3.2vw, 48px)",
                color: BLUE,
                letterSpacing: "-0.005em",
                transform: "translateY(2px)",
              }}
            >
              POPCORN
            </h1>
            <PopcornLogo />
          </div>

          {/* Right-aligned tagline — mixed-type editorial pairing:
              big Newsreader italic ascender for the brand promise,
              quiet Macabro tracked caps for the cadence line. */}
          <div
            className="hidden md:flex flex-col items-end pb-1"
            style={{ color: BLUE }}
          >
            <div
              style={{
                fontFamily: "'Newsreader', serif",
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: "clamp(20px, 1.7vw, 28px)",
                lineHeight: 1,
                letterSpacing: "-0.012em",
                color: BLUE,
              }}
            >
              Your pop culture brief
            </div>
            <div
              className="mt-2"
              style={{
                fontFamily: "'Macabro', serif",
                fontSize: "10px",
                letterSpacing: "0.42em",
                color: INK,
                opacity: 0.72,
                paddingRight: "1px",
              }}
            >
              PRINTED&nbsp;&nbsp;FRESH&nbsp;&nbsp;DAILY
            </div>
          </div>
        </div>

      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Popcorn logo — the canonical popcorn bucket illustration, served as a
   transparent PNG from /public. Scales fluidly alongside the wordmark.
   ────────────────────────────────────────────────────────────────────── */

function PopcornLogo() {
  return (
    <img
      src="/popcorn-logo.png"
      alt="Popcorn"
      aria-hidden="true"
      style={{
        width: "clamp(72px, 6.6vw, 104px)",
        height: "auto",
        objectFit: "contain",
        display: "block",
        flexShrink: 0,
        marginLeft: "8px",
        transform: "translateY(10px)",
      }}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Edition rule — "TUESDAY, MAY 19 · 26 STORIES" sandwich rule
   ────────────────────────────────────────────────────────────────────── */

function EditionRule({
  date,
  count,
  isFirst = false,
}: {
  date: Date;
  count?: number;
  isFirst?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-6"
      style={{ marginTop: isFirst ? "24px" : "48px", marginBottom: "32px" }}
    >
      <div className="flex-1 h-px" style={{ background: "rgba(5,57,128,0.28)" }} />
      <div
        className="flex items-center gap-3 uppercase whitespace-nowrap"
        style={{
          color: BLUE,
          letterSpacing: "0.28em",
          fontFamily: "'Macabro', serif",
          fontSize: "17px",
        }}
      >
        <PopcornKernel size={18} color={POP_YELLOW} />
        <span>{format(date, "EEEE · MMMM d").toUpperCase()}</span>
        {typeof count === "number" && (
          <>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ opacity: 0.7, fontSize: "12px", letterSpacing: "0.32em" }}>
              {count} {count === 1 ? "STORY" : "STORIES"}
            </span>
          </>
        )}
        <PopcornKernel size={18} color={POP_YELLOW} />
      </div>
      <div className="flex-1 h-px" style={{ background: "rgba(5,57,128,0.28)" }} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Category nav — Editorial cross-reference. No opaque chrome; renders
   directly on the grain paper so the texture reads through. A tiny
   tracked Macabro label ("INDEX") sits beside the current topic, set in
   italic Newsreader serif, with a hairline rule beneath. Clicking opens
   a paper-card panel of all topics. The whole row feels like a
   typographic credit line in a magazine, not a UI bar.
   ────────────────────────────────────────────────────────────────────── */

function CategoryNav({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (c: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Click-outside + ESC to close
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const currentLabel = selected
    ? (CATEGORY_LABEL[selected] ?? selected)
    : "All stories";

  return (
    <div className="max-w-[1320px] mx-auto px-10 pt-5 pb-2">
      <div ref={rootRef} className="relative inline-flex items-baseline gap-4">

        {/* Hair-fine vertical divider */}
        <span
          className="inline-block self-center"
          style={{
            width: "1px",
            height: "14px",
            background: "rgba(5,57,128,0.3)",
          }}
        />

        {/* Trigger — pure typography, no chrome. Underline on hover/open
            mimics a real editorial link. */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="group inline-flex items-baseline gap-2.5 cursor-pointer"
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            color: BLUE,
            fontFamily: "'Newsreader', serif",
            fontSize: "20px",
            fontStyle: "italic",
            fontWeight: 500,
            letterSpacing: "-0.005em",
            lineHeight: 1,
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span
            style={{
              borderBottom: `1px solid ${open || selected ? BLUE : "rgba(5,57,128,0.45)"}`,
              paddingBottom: "2px",
              transition: "border-color 200ms ease-out",
            }}
            className="group-hover:!border-current"
          >
            {currentLabel}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.8}
            style={{
              color: BLUE,
              opacity: 0.7,
              transform: open ? "rotate(180deg)" : "rotate(0)",
              transition: "transform 240ms cubic-bezier(0.65, 0, 0.35, 1)",
            }}
          />
        </button>

        {selected && (
          <button
            onClick={() => onSelect(null)}
            className="text-[10px] uppercase hover:opacity-100 transition-opacity"
            style={{
              color: BLUE,
              opacity: 0.55,
              letterSpacing: "0.32em",
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 600,
              marginLeft: "8px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}

        {/* Panel — paper card with a soft drop and a hairline border.
            Two-column layout so all 13 topics + "All" read like an
            index-page table-of-contents. */}
        {open && (
          <div
            role="listbox"
            className="absolute left-0 top-full mt-4 z-40 overflow-hidden"
            style={{
              background: PAPER,
              border: `1px solid rgba(5,57,128,0.22)`,
              borderRadius: "2px",
              boxShadow:
                "0 24px 60px -18px rgba(5,57,128,0.38), 0 2px 8px -2px rgba(5,57,128,0.12)",
              minWidth: "440px",
              padding: "22px 26px 24px",
              animation: "popcorn-index-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both",
            }}
          >
            <style>
              {`@keyframes popcorn-index-in {
                  0% { opacity: 0; transform: translateY(-6px); }
                  100% { opacity: 1; transform: translateY(0); }
                }`}
            </style>

            {/* Panel header */}
            <div
              className="text-[9px] uppercase mb-4 pb-3"
              style={{
                color: BLUE,
                opacity: 0.55,
                letterSpacing: "0.42em",
                fontFamily: "'Macabro', serif",
                borderBottom: "1px solid rgba(5,57,128,0.18)",
              }}
            >
              <span>Editorial index</span>
              <span style={{ margin: "0 10px", opacity: 0.5 }}>·</span>
              <span style={{ fontStyle: "italic", textTransform: "none", fontFamily: "'Newsreader', serif", fontSize: "11px", letterSpacing: "0" }}>
                pick a topic to read only those stories
              </span>
            </div>

            <IndexOption
              label="All stories"
              active={selected === null}
              isLead
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
            />

            <div className="grid grid-cols-2 gap-x-8 mt-2">
              {ALL_CATEGORIES.map((c) => (
                <IndexOption
                  key={c}
                  label={CATEGORY_LABEL[c] ?? c}
                  active={selected === c}
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IndexOption({
  label,
  active,
  isLead = false,
  onClick,
}: {
  label: string;
  active: boolean;
  isLead?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      role="option"
      aria-selected={active}
      className="w-full flex items-baseline justify-between gap-3 py-1.5 text-left group"
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontFamily: "'Newsreader', serif",
        fontSize: isLead ? "17px" : "16px",
        color: BLUE,
        fontWeight: active ? 600 : 400,
        fontStyle: active ? "italic" : "normal",
        opacity: active ? 1 : 0.82,
        transition: "opacity 160ms ease-out, transform 160ms ease-out",
      }}
    >
      <span
        className="transition-all"
        style={{
          borderBottom: active ? `1px solid ${BLUE}` : "1px solid transparent",
          paddingBottom: "2px",
        }}
      >
        {label}
      </span>
      {active && (
        <Check size={13} strokeWidth={2.2} style={{ color: BLUE, transform: "translateY(-1px)" }} />
      )}
      {!active && (
        <span
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            color: BLUE,
            fontSize: "13px",
            fontFamily: "'Manrope', sans-serif",
            letterSpacing: "0.3em",
          }}
        >
          →
        </span>
      )}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Topic header — shown only when a category is selected. Big Macabro
   topic name, story count, and a back link.
   ────────────────────────────────────────────────────────────────────── */

function TopicHeader({
  category,
  totalCount,
  onBack,
}: {
  category: string;
  totalCount: number;
  onBack: () => void;
}) {
  const label = CATEGORY_LABEL[category] ?? category;
  return (
    <section
      className="w-full border-b"
      style={{ borderColor: "rgba(5,57,128,0.18)" }}
    >
      <div className="max-w-[1320px] mx-auto px-10 pt-12 pb-10">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 mb-6 hover:opacity-70 transition-opacity"
          style={{
            color: BLUE,
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 600,
            fontSize: "11px",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
          }}
        >
          <ChevronLeft size={14} strokeWidth={2} />
          All stories
        </button>
        <div className="flex items-end justify-between gap-10 flex-wrap">
          <h2
            className="leading-none"
            style={{
              fontFamily: "'Macabro', serif",
              fontSize: "clamp(56px, 7vw, 104px)",
              color: BLUE,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
            }}
          >
            {label}
          </h2>
          <p
            className="pb-3"
            style={{
              fontFamily: "'Newsreader', serif",
              fontStyle: "italic",
              fontSize: "18px",
              color: BLUE,
              opacity: 0.78,
            }}
          >
            {totalCount} {totalCount === 1 ? "story" : "stories"} · rolling daily
          </p>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Day row — horizontal scroller. Cards snap into place; chevron arrows
   slide the row by ~one card width at a time. Hides scrollbar.
   ────────────────────────────────────────────────────────────────────── */

function DayRow({
  label,
  articles,
  onOpen,
}: {
  label?: string;
  articles: NewsArticle[];
  onOpen: (a: NewsArticle) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, articles.length]);

  const scrollBy = useCallback((dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // One "page" ≈ visible width minus a peek so the next card is hinted
    const delta = (el.clientWidth - 80) * dir;
    el.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  return (
    <div className="relative mt-2">
      {label && (
        <div
          className="mb-5 text-[11px] uppercase"
          style={{
            color: BLUE,
            opacity: 0.75,
            letterSpacing: "0.32em",
            fontFamily: "'Macabro', serif",
          }}
        >
          {label}
        </div>
      )}

      {/* Edge fades — soft cream gradients so cards bleed off rather than
          getting hard-cropped at the container edge. */}
      <div
        className="pointer-events-none absolute top-0 bottom-0 left-0 w-12 z-10"
        style={{
          background: `linear-gradient(to right, ${PAPER}, rgba(251,244,220,0))`,
          opacity: canLeft ? 1 : 0,
          transition: "opacity 200ms ease-out",
        }}
      />
      <div
        className="pointer-events-none absolute top-0 bottom-0 right-0 w-12 z-10"
        style={{
          background: `linear-gradient(to left, ${PAPER}, rgba(251,244,220,0))`,
          opacity: canRight ? 1 : 0,
          transition: "opacity 200ms ease-out",
        }}
      />

      {/* Arrows */}
      <RowArrow
        direction="left"
        visible={canLeft}
        onClick={() => scrollBy(-1)}
      />
      <RowArrow
        direction="right"
        visible={canRight}
        onClick={() => scrollBy(1)}
      />

      <div
        ref={scrollerRef}
        className="flex gap-7 overflow-x-auto scrollbar-hide pb-2"
        style={{
          scrollSnapType: "x mandatory",
          scrollPaddingLeft: "0px",
        }}
      >
        {articles.map((a) => (
          <DayRowCard key={a.id} article={a} onOpen={() => onOpen(a)} />
        ))}
      </div>
    </div>
  );
}

function RowArrow({
  direction,
  visible,
  onClick,
}: {
  direction: "left" | "right";
  visible: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={direction === "left" ? "Scroll left" : "Scroll right"}
      className="absolute top-[28%] z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
      style={{
        background: BLUE,
        color: CREAM,
        boxShadow: "0 6px 20px -6px rgba(5,57,128,0.45)",
        [direction]: "-12px",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transitionProperty: "opacity, transform",
        transitionDuration: "220ms",
      } as React.CSSProperties}
    >
      <Icon size={18} strokeWidth={2.2} />
    </button>
  );
}

function DayRowCard({
  article,
  onOpen,
}: {
  article: NewsArticle;
  onOpen: () => void;
}) {
  const img = article.imageUrl ? feedImageUrl(article.imageUrl) : null;
  return (
    <article
      className="shrink-0 cursor-pointer group"
      style={{
        // ~5 cards visible at 1320px container width, scaling down on smaller
        // viewports. min/max keep cards readable across desktop sizes.
        width: "clamp(240px, 19vw, 280px)",
        scrollSnapAlign: "start",
      }}
      onClick={onOpen}
    >
      {img ? (
        <div className="relative overflow-hidden mb-4" style={{ aspectRatio: "4 / 5" }}>
          <img
            src={img}
            alt={article.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.05]"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ boxShadow: "inset 0 0 0 1px rgba(5,57,128,0.12)" }}
          />
        </div>
      ) : (
        <div
          className="mb-4"
          style={{
            aspectRatio: "4 / 5",
            background: `linear-gradient(135deg, ${article.gradientStart}, ${article.gradientEnd})`,
          }}
        />
      )}
      <CategoryEyebrow category={article.category} />
      <h3
        className="mt-2.5 group-hover:underline decoration-1 underline-offset-[5px]"
        style={{
          fontFamily: "'Newsreader', serif",
          fontSize: "20px",
          lineHeight: 1.18,
          color: INK,
          letterSpacing: "-0.003em",
          fontWeight: 500,
          textDecorationColor: "rgba(5,57,128,0.6)",
        }}
      >
        {article.title}
      </h3>
    </article>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Hero lead — asymmetric: large image on left, headline column right
   ────────────────────────────────────────────────────────────────────── */

function HeroLead({
  article,
  onOpen,
}: {
  article: NewsArticle;
  onOpen: () => void;
}) {
  const img = article.imageUrl ? feedImageUrl(article.imageUrl) : null;
  const rawSummary = article.summary ?? "";
  const firstSentenceMatch = rawSummary.match(/^[^.!?]*[.!?]/);
  const summary = firstSentenceMatch ? firstSentenceMatch[0].trim() : rawSummary;
  const dropCap = summary.charAt(0) || "T";
  const dropRest = summary.slice(1);
  return (
    <article
      className="grid grid-cols-12 gap-10 cursor-pointer group"
      onClick={onOpen}
    >
      {/* Image — 5 cols */}
      <div className="col-span-5 relative overflow-hidden" style={{ aspectRatio: "4 / 3" }}>
        {img ? (
          <img
            src={img}
            alt={article.title}
            loading="eager"
            className="w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.025]"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${article.gradientStart}, ${article.gradientEnd})`,
            }}
          />
        )}
        {/* hairline frame */}
        <div className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 0 1px rgba(5,57,128,0.12)" }} />
      </div>

      {/* Text column — 7 cols */}
      <div className="col-span-7 flex flex-col justify-center pt-2 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <CategoryEyebrow category={article.category} />
          </div>
          <h2
            className="mt-4"
            style={{
              fontFamily: "'Newsreader', serif",
              fontSize: "clamp(28px, 2.6vw, 42px)",
              lineHeight: 1.06,
              color: INK,
              letterSpacing: "-0.012em",
              fontWeight: 500,
            }}
          >
            {article.title}
          </h2>
          {summary && (
            <p
              className="mt-5"
              style={{
                fontFamily: "'Newsreader', serif",
                fontSize: "17px",
                lineHeight: 1.55,
                color: "rgba(10,42,90,0.82)",
                fontWeight: 400,
                maxWidth: "640px",
              }}
            >
              <span
                style={{
                  float: "left",
                  fontFamily: "'Newsreader', serif",
                  fontWeight: 700,
                  fontSize: "58px",
                  lineHeight: 0.82,
                  color: BLUE,
                  paddingRight: "9px",
                  paddingTop: "5px",
                }}
              >
                {dropCap}
              </span>
              {dropRest}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Category eyebrow — tiny tracked uppercase Macabro
   ────────────────────────────────────────────────────────────────────── */

function CategoryEyebrow({ category }: { category: string }) {
  const label = CATEGORY_LABEL[category] ?? category;
  return (
    <span
      className="inline-block"
      style={{
        fontFamily: "'Macabro', serif",
        fontSize: "11px",
        letterSpacing: "0.32em",
        color: BLUE,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Byline — source · X min read
   ────────────────────────────────────────────────────────────────────── */

function ByLine({
  source,
  readTime,
  small = false,
}: {
  source: string;
  readTime: number;
  small?: boolean;
}) {
  return (
    <div
      className={small ? "mt-3" : "mt-6"}
      style={{
        fontFamily: "'Manrope', sans-serif",
        fontSize: small ? "10.5px" : "11px",
        letterSpacing: "0.22em",
        color: BLUE,
        opacity: 0.65,
        textTransform: "uppercase",
        fontWeight: 600,
      }}
    >
      {source} <span style={{ opacity: 0.6, margin: "0 8px" }}>·</span> {readTime} min read
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Footer
   ────────────────────────────────────────────────────────────────────── */

function DesktopFooter() {
  const columns: Array<{ heading: string; links: string[] }> = [
    {
      heading: "The Paper",
      links: ["Today's Edition", "Archive", "All Categories", "RSS Feed"],
    },
    {
      heading: "The Company",
      links: ["About Popcorn", "Editorial Standards", "Contact", "Press"],
    },
    {
      heading: "Get It Everywhere",
      links: ["iOS App", "Newsletter", "Instagram", "Twitter / X"],
    },
  ];

  return (
    <footer className="relative w-full mt-24" aria-label="Popcorn footer">
      <div
        className="relative w-full"
        style={{ background: BLUE, color: CREAM, overflow: "hidden" }}
      >
        {/* Textured grain on the blue background, per house style.
            Extends UP through the scallop strip so the bumps inherit
            the same grain texture as the rest of the footer field. */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <GrainBackground variant="popcorn-blue" />
        </div>

        {/* Scalloped rim — cream cutout overlaid on the textured blue,
            so the bumps you see ARE the textured field showing through. */}
        <div className="relative" aria-hidden>
          <ScallopDivider cutout bg={CREAM} scallops={42} height={18} />
        </div>

        <div className="relative max-w-[1320px] mx-auto px-10 pt-4 pb-10">
          {/* Top: oversized wordmark + columns */}
          <div className="grid grid-cols-12 gap-10 items-start">
            <div className="col-span-5">
              <div className="flex items-center gap-4">
                <div
                  className="leading-none"
                  style={{
                    fontFamily: "'Macabro', serif",
                    fontSize: "64px",
                    color: CREAM,
                    letterSpacing: "-0.005em",
                  }}
                >
                  Popcorn
                </div>
              </div>
              <p
                className="mt-6"
                style={{
                  fontFamily: "'Newsreader', serif",
                  fontStyle: "italic",
                  fontSize: "17px",
                  color: CREAM,
                  opacity: 0.85,
                  maxWidth: "440px",
                  lineHeight: 1.5,
                }}
              >
                A daily edit of the stories rippling through music, film, the
                internet and culture. Hand-picked, written for humans, read in
                twenty minutes flat.
              </p>
              <div
                className="mt-7 flex items-center gap-3"
                style={{
                  fontFamily: "'Macabro', serif",
                  fontSize: "10px",
                  letterSpacing: "0.28em",
                  color: CREAM,
                  opacity: 0.7,
                }}
              >
                <RegistrationMark color={CREAM} size={12} />
                <span>EST. 2025 · BANGKOK</span>
                <PopcornKernel size={14} color={POP_YELLOW} />
                <span>PRINTED FRESH DAILY</span>
              </div>
            </div>

            {columns.map((col) => (
              <div key={col.heading} className="col-span-2">
                <div
                  className="mb-5"
                  style={{
                    fontFamily: "'Macabro', serif",
                    fontSize: "10px",
                    letterSpacing: "0.32em",
                    color: POP_YELLOW,
                    textTransform: "uppercase",
                  }}
                >
                  {col.heading}
                </div>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="hover:opacity-100 transition-opacity"
                        style={{
                          fontFamily: "'Newsreader', serif",
                          fontSize: "16px",
                          color: CREAM,
                          opacity: 0.85,
                          textDecoration: "none",
                        }}
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="col-span-1 flex flex-col items-end gap-2 pt-2">
              <PopcornKernel size={22} color={POP_YELLOW} />
              <PopcornKernel size={16} color={POP_YELLOW} />
              <PopcornKernel size={12} color={POP_YELLOW} />
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Loading state — minimalist editorial skeleton
   ────────────────────────────────────────────────────────────────────── */

function LoadingState() {
  return (
    <main className="max-w-[1320px] mx-auto px-10 pt-16 pb-32">
      <div
        className="text-[11px] uppercase"
        style={{
          color: BLUE,
          letterSpacing: "0.32em",
          fontFamily: "'Macabro', serif",
          opacity: 0.6,
        }}
      >
        Loading the morning's stories…
      </div>
      <div className="grid grid-cols-12 gap-10 mt-12">
        <div
          className="col-span-7 animate-pulse"
          style={{ aspectRatio: "4 / 3", background: "rgba(5,57,128,0.08)" }}
        />
        <div className="col-span-5">
          <div className="h-3 w-24 mb-6 animate-pulse" style={{ background: "rgba(5,57,128,0.15)" }} />
          <div className="h-12 w-full mb-3 animate-pulse" style={{ background: "rgba(5,57,128,0.1)" }} />
          <div className="h-12 w-3/4 mb-8 animate-pulse" style={{ background: "rgba(5,57,128,0.1)" }} />
          <div className="h-4 w-full mb-2 animate-pulse" style={{ background: "rgba(5,57,128,0.06)" }} />
          <div className="h-4 w-5/6 mb-2 animate-pulse" style={{ background: "rgba(5,57,128,0.06)" }} />
        </div>
      </div>
    </main>
  );
}
