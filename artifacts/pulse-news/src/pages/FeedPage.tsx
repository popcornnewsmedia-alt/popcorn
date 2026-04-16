import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { isSameDay, startOfDay, subDays } from "date-fns";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleReader } from "@/components/ArticleReader";
import { SplashScreen } from "@/components/SplashScreen";
import { SignUpFlow } from "@/components/SignUpFlow";
import { SignInSheet } from "@/components/SignInSheet";
import { AccountChoiceSheet } from "@/components/AccountChoiceSheet";
import { LegalSheet, type LegalKind } from "@/components/LegalSheet";
import { NotificationsSheet } from "@/components/NotificationsSheet";
import { PopcornIcon } from "@/components/PopcornIcon";
import { DateDividerCard } from "@/components/DateDividerCard";
import { GrainBackground } from "@/components/GrainBackground";
import { useInfiniteNewsFeed } from "@/hooks/use-news";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { supabase } from "@/lib/supabase";
import { AlertCircle, RefreshCw, Bookmark, User, LogOut, ChevronRight } from "lucide-react";
import type { NewsArticle } from "@workspace/api-client-react";
import { isStandalone } from "@/lib/utils";

type Tab = "feed" | "saved" | "profile";

function dividerIdForDate(d: Date) {
  return `day-divider-${startOfDay(d).getTime()}`;
}

// ── Image URL optimisation ─────────────────────────────────────────────────
// The single biggest cause of visible transition lag on mobile is DECODE time
// for 4000×6000+ source images — a flagship phone takes 300–500ms to decode
// a 19-megapixel JPEG on the main thread. Rewriting the URL to a viewport-
// friendly size at the CDN level drops decode time to ~40ms, which makes
// transitions feel like a native TikTok/Instagram reel feed.
//
// 1080 is the sweet spot: it covers every phone at DPR 1-3 (iPhone 14 Pro
// logical width = 393 → DPR 3 = 1179 native px) while keeping JPEG decode
// under ~50ms on mid-range Android.
//
//  • Wikipedia Commons: rewrite bare-file URLs to the /thumb/ variant at
//    1080px wide. Downsize existing /thumb/ URLs that are larger than 1080.
//  • WordPress wp-content/uploads (Variety, NME, Consequence, Futurism,
//    Pagesix, Stereogum, Verge, etc.): append ?w=1080 if no explicit width
//    is already set. Jetpack / Photon respects this and returns a resized
//    JPEG; sites without Photon fall back to serving the original (no error).
//
// All other URLs (YouTube thumbnails, Unsplash, iTunes, etc.) are left alone
// because they're either already viewport-sized or don't support resize
// query params.
const TARGET_IMAGE_WIDTH = 1080;

function optimizeImageUrl(url: string | null | undefined): string | null | undefined {
  if (!url || typeof url !== 'string') return url;

  // Wikipedia Commons — skip optimization. Wikipedia's thumbnail service
  // frequently returns 503 for programmatically constructed /thumb/ URLs,
  // especially with URL-encoded filenames. The original full-res images
  // load reliably and modern browsers handle decode efficiently.

  // WordPress wp-content/uploads JPG / PNG → ensure ?w=1080
  const isWpImg =
    /\/wp-content\/uploads\//i.test(url) &&
    /\.(jpe?g|png)(\?|$)/i.test(url);
  if (isWpImg && !/[?&]w=\d+/i.test(url)) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}w=${TARGET_IMAGE_WIDTH}`;
  }

  return url;
}

// ── Pull-to-refresh popcorn animation (compact version of SplashScreen SVG) ──
function PopcornRefreshAnim({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 100 100" width="60" height="60" aria-hidden="true" style={{ overflow: 'visible' }}>
      {active && (
        <style>{`
          @keyframes ptr-a{0%,100%{transform:translateY(0) scaleY(1) scaleX(1)}20%{transform:translateY(1px) scaleY(.88) scaleX(1.1)}50%{transform:translateY(-8px) scaleY(1.12) scaleX(.91)}75%{transform:translateY(-5px) scaleY(1.06) scaleX(.96)}}
          @keyframes ptr-b{0%,100%{transform:translateY(0) scaleY(1) scaleX(1)}20%{transform:translateY(1px) scaleY(.85) scaleX(1.12)}50%{transform:translateY(-10px) scaleY(1.14) scaleX(.89)}75%{transform:translateY(-7px) scaleY(1.07) scaleX(.95)}}
          @keyframes ptr-c{0%,100%{transform:translateY(0) scaleY(1) scaleX(1)}20%{transform:translateY(1px) scaleY(.9) scaleX(1.08)}50%{transform:translateY(-7px) scaleY(1.1) scaleX(.92)}75%{transform:translateY(-4px) scaleY(1.05) scaleX(.97)}}
          .ptr-pa{animation:ptr-a 1.1s cubic-bezier(.34,1.5,.64,1) infinite;transform-box:fill-box;transform-origin:center 90%}
          .ptr-pb{animation:ptr-b 1.1s cubic-bezier(.34,1.5,.64,1) infinite .18s;transform-box:fill-box;transform-origin:center 90%}
          .ptr-pc{animation:ptr-c 1.1s cubic-bezier(.34,1.5,.64,1) infinite .36s;transform-box:fill-box;transform-origin:center 90%}
          @keyframes ptr-rumble{0%,100%{transform:none}20%{transform:translateX(-1px) rotate(-.3deg)}50%{transform:translateX(1px) rotate(.3deg)}80%{transform:translateX(-.5px)}}
          .ptr-bucket{animation:ptr-rumble .35s ease-in-out infinite;transform-box:fill-box;transform-origin:center 50%}
          @keyframes ptr-heat{0%,100%{opacity:.1}50%{opacity:.24}}
          .ptr-heat{animation:ptr-heat .9s ease-in-out infinite}
          @keyframes ptr-k1{0%{transform:translate(0,0) scale(0);opacity:0}7%{transform:translate(-2px,-5px) scale(1);opacity:1}55%{transform:translate(-18px,-28px) scale(.9);opacity:1}100%{transform:translate(-22px,-10px) scale(0);opacity:0}}
          @keyframes ptr-k2{0%{transform:translate(0,0) scale(0);opacity:0}7%{transform:translate(2px,-5px) scale(1);opacity:1}55%{transform:translate(16px,-30px) scale(.9);opacity:1}100%{transform:translate(19px,-12px) scale(0);opacity:0}}
          @keyframes ptr-k3{0%{transform:translate(0,0) scale(0);opacity:0}7%{transform:translate(0,-6px) scale(1);opacity:1}55%{transform:translate(-4px,-35px) scale(.9);opacity:1}100%{transform:translate(-5px,-18px) scale(0);opacity:0}}
          .ptr-k1{animation:ptr-k1 1.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
          .ptr-k2{animation:ptr-k2 1.5s ease-in-out infinite .3s;transform-box:fill-box;transform-origin:center}
          .ptr-k3{animation:ptr-k3 1.4s ease-in-out infinite .6s;transform-box:fill-box;transform-origin:center}
        `}</style>
      )}
      {/* Heat glow */}
      <ellipse className={active ? "ptr-heat" : ""} cx="50" cy="61" rx="16" ry="8" fill="#fff1cd" opacity={active ? undefined : 0.15}/>
      {/* Bucket */}
      <g className={active ? "ptr-bucket" : ""}>
        <rect x="30" y="58" width="40" height="6" rx="2" fill="#fff1cd"/>
        <path d="M32 64 L36 90 L64 90 L68 64Z" fill="transparent" stroke="#fff1cd" strokeWidth="1.6" strokeLinejoin="round"/>
      </g>
      {/* Flying kernels (only when active) */}
      {active && (
        <>
          <g className="ptr-k1"><circle cx="50" cy="60" r="3" fill="#fff1cd"/><circle cx="47.5" cy="58" r="2" fill="#fff1cd"/></g>
          <g className="ptr-k2"><circle cx="50" cy="60" r="2.8" fill="#fff1cd"/><circle cx="52.5" cy="58" r="2" fill="#fff1cd"/></g>
          <g className="ptr-k3"><circle cx="50" cy="60" r="2.6" fill="#fff1cd"/><circle cx="48" cy="57.5" r="1.8" fill="#fff1cd"/></g>
        </>
      )}
      {/* Puffs */}
      <g className={active ? "ptr-pa" : ""}>
        <circle cx="36" cy="51" r="5" fill="#fff1cd"/><circle cx="31" cy="47" r="3.5" fill="#fff1cd"/><circle cx="36" cy="43" r="4" fill="#fff1cd"/><circle cx="41" cy="47" r="3.5" fill="#fff1cd"/>
      </g>
      <g className={active ? "ptr-pb" : ""}>
        <circle cx="50" cy="47" r="6" fill="#fff1cd"/><circle cx="44" cy="42" r="4" fill="#fff1cd"/><circle cx="50" cy="37" r="5" fill="#fff1cd"/><circle cx="56" cy="42" r="4" fill="#fff1cd"/>
      </g>
      <g className={active ? "ptr-pc" : ""}>
        <circle cx="64" cy="51" r="5" fill="#fff1cd"/><circle cx="59" cy="47" r="3.5" fill="#fff1cd"/><circle cx="64" cy="43" r="4" fill="#fff1cd"/><circle cx="69" cy="47" r="3.5" fill="#fff1cd"/>
      </g>
    </svg>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  'Music':        '#e879f9',
  'Film & TV':    '#60a5fa',
  'Gaming':       '#a3e635',
  'Fashion':      '#f472b6',
  'Culture':      '#fb923c',
  'Sports':       '#34d399',
  'Science':      '#22d3ee',
  'AI':           '#818cf8',
  'Social Media': '#fbbf24',
  'Technology':   '#2dd4bf',
  'Internet':     '#60a5fa',
  'World':        '#6ee7b7',
  'Industry':     '#94a3b8',
  'Books':        '#f59e0b',
};

function SavedScreen({
  onBrowse,
  articles,
  onReadMore,
}: {
  onBrowse: () => void;
  articles: NewsArticle[];
  onReadMore: (article: NewsArticle) => void;
}) {
  if (articles.length === 0) {
    return (
      <div className="pn-fullscreen fixed inset-0 flex flex-col items-center justify-center px-8 text-center overflow-hidden" style={{ background: "#053980", zIndex: 1 }}>
        <GrainBackground />
        <div className="relative z-10 flex flex-col items-center gap-5 max-w-xs">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-2"
            style={{
              background: "rgba(255,241,205,0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,241,205,0.22)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            }}
          >
            <Bookmark className="w-8 h-8" style={{ color: "#fff1cd", strokeWidth: 1.6 }} />
          </div>
          <div className="flex flex-col gap-2">
            <h1
              style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "18px", lineHeight: 1.1, color: "#fff1cd", letterSpacing: "0.02em" }}
            >
              Nothing saved yet
            </h1>
            <p
              className="font-['Manrope'] leading-relaxed"
              style={{ fontSize: "14px", color: "rgba(255,241,205,0.48)" }}
            >
              Bookmark articles as you scroll to build your reading list.
            </p>
          </div>
          <button
            onClick={onBrowse}
            className="mt-3 px-8 py-3 rounded-full font-['Inter'] font-semibold text-sm tracking-wide transition-opacity hover:opacity-85"
            style={{ background: "#fff1cd", color: "#053980" }}
          >
            Browse
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pn-fullscreen fixed inset-0 overflow-hidden flex flex-col items-center" style={{ background: "#053980", zIndex: 1 }}>
      <GrainBackground />
      <div className="relative z-10 flex flex-col h-full w-full" style={{ maxWidth: '480px' }}>
        {/* Header */}
        <div className="px-5 pb-4" style={{ paddingTop: 'calc(72px + env(safe-area-inset-top))' }}>
          <h2
            style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "19px", color: "#fff1cd", letterSpacing: "0.02em", lineHeight: 1 }}
          >
            Saved
          </h2>
          <p className="font-['Inter'] mt-0.5" style={{ fontSize: "13px", color: "rgba(255,241,205,0.6)" }}>
            {articles.length} {articles.length === 1 ? "article" : "articles"}
          </p>
          <div style={{ marginTop: "12px", height: "1px", background: "rgba(255,241,205,0.10)" }} />
        </div>

        {/* Article list */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 scrollbar-hide flex flex-col gap-3">
          {articles.map((article, i) => (
            <button
              key={article.id}
              onClick={() => onReadMore(article)}
              className="w-full text-left rounded-2xl overflow-hidden flex gap-0 active:opacity-70"
              style={{
                background: "rgba(255,241,205,0.07)",
                border: "1px solid rgba(255,241,205,0.08)",
                boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
                opacity: 0,
                animation: "saved-card-in 0.38s ease forwards",
                animationDelay: `${i * 0.06}s`,
              }}
            >
              {article.imageUrl && (
                <div className="w-28 self-stretch flex-shrink-0 relative overflow-hidden">
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
                  />
                </div>
              )}
              <div className="flex-1 p-3.5 flex flex-col justify-between min-w-0 gap-2">
                {/* Category + source pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className="flex items-center gap-1"
                    style={{ background: 'rgba(255,241,205,0.10)', border: '1px solid rgba(255,241,205,0.16)', borderRadius: 999, paddingLeft: 5, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}
                  >
                    <span style={{
                      display: 'inline-block', width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                      background: CATEGORY_COLORS[article.category] ?? 'rgba(255,241,205,0.4)',
                      boxShadow: `0 0 4px 1px ${CATEGORY_COLORS[article.category] ?? 'rgba(255,241,205,0.3)'}`,
                    }} />
                    <span style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "8px", color: "rgba(255,241,205,0.85)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
                      {article.category}
                    </span>
                  </span>
                  <span
                    style={{ background: 'rgba(255,241,205,0.07)', border: '1px solid rgba(255,241,205,0.12)', borderRadius: 999, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "8px", color: "rgba(255,241,205,0.50)", letterSpacing: "0.08em" }}
                  >
                    {article.source}
                  </span>
                </div>
                {/* Title */}
                <p
                  className="font-['Manrope'] font-bold leading-snug line-clamp-2"
                  style={{ fontSize: "14px", color: "#fff1cd" }}
                >
                  {article.title}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const APP_VERSION = "1.0.0";

function LegalRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3.5 transition-colors active:bg-white/5"
      style={{
        fontFamily: "'Inter', sans-serif",
        fontWeight: 500,
        fontSize: "14px",
        color: "#fff1cd",
        background: "transparent",
      }}
    >
      <span>{label}</span>
      <ChevronRight className="w-4 h-4" style={{ color: "rgba(255,241,205,0.38)" }} strokeWidth={2} />
    </button>
  );
}

function ProfileScreen({
  onSignIn,
  onCreateAccount,
  onSignOut,
  onOpenLegal,
  onOpenNotifications,
  unreadCount,
  userName,
  userEmail,
  userAvatar,
  topics,
}: {
  onSignIn: () => void;
  onCreateAccount: () => void;
  onSignOut: () => void;
  onOpenLegal: (kind: LegalKind) => void;
  onOpenNotifications: () => void;
  unreadCount: number;
  userName: string | null;
  userEmail: string | null;
  userAvatar: string | null;
  topics: string[];
}) {
  const isLoggedIn = !!userName || !!userEmail;
  const initial = (userName ?? userEmail ?? "?")[0].toUpperCase();

  return (
    <div className="pn-fullscreen fixed inset-0 flex flex-col items-center overflow-hidden" style={{ background: "#053980", zIndex: 1 }}>
      <GrainBackground />

      {isLoggedIn ? (
        /* ── Signed-in view ── */
        <div
          className="relative z-10 flex flex-col h-full overflow-y-auto scrollbar-hide pb-28 mx-auto w-full"
          style={{ paddingTop: 'calc(72px + env(safe-area-inset-top))', maxWidth: '480px' }}
        >

          {/* Avatar + identity */}
          <div className="px-5 flex items-center gap-4 mb-6">
            <div style={{
              width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
              background: "rgba(255,241,205,0.09)",
              border: "1.5px solid rgba(255,241,205,0.22)",
              boxShadow: "0 0 0 5px rgba(255,241,205,0.05)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              {userAvatar ? (
                <img src={userAvatar} alt={userName ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "24px", color: "#fff1cd", lineHeight: 1 }}>
                  {initial}
                </span>
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              {userName && (
                <div className="flex items-center gap-2 min-w-0">
                  <h1 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "20px", color: "#fff1cd", letterSpacing: "0.02em", lineHeight: 1.1 }} className="truncate">
                    {userName}
                  </h1>
                  <button
                    onClick={onOpenNotifications}
                    className="transition-opacity active:opacity-60 hover:opacity-80"
                    style={{ flexShrink: 0, lineHeight: 0, padding: 2 }}
                    aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                  >
                    <PopcornIcon size={36} hasDot={unreadCount > 0} />
                  </button>
                </div>
              )}
              {userEmail && (
                <p className="font-['Inter'] mt-1 truncate" style={{ fontSize: "12px", color: "rgba(255,241,205,0.45)" }}>
                  {userEmail}
                </p>
              )}
            </div>
          </div>

          {/* Topics */}
          {topics.length > 0 && (
            <div className="px-5 mb-6">
              <div style={{ height: "1px", background: "rgba(255,241,205,0.08)", marginBottom: 16 }} />
              <p style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "10px", color: "rgba(255,241,205,0.38)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                Your Topics
              </p>
              <div className="flex flex-wrap gap-2">
                {topics.map(t => (
                  <span
                    key={t}
                    className="px-3 py-1.5 font-['Inter'] font-medium"
                    style={{ fontSize: "12px", background: "rgba(255,241,205,0.08)", color: "#fff1cd", borderRadius: 20, border: "1px solid rgba(255,241,205,0.12)" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* About Popcorn */}
          <div className="px-5 mb-6">
            <div style={{ height: "1px", background: "rgba(255,241,205,0.08)", marginBottom: 16 }} />
            <button
              onClick={() => onOpenLegal("about")}
              className="flex items-center gap-2 transition-opacity active:opacity-60 hover:opacity-80"
              style={{
                fontFamily: "'Macabro', 'Anton', sans-serif",
                fontSize: "12px",
                color: "#fff1cd",
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                background: "rgba(255,241,205,0.08)",
                border: "1px solid rgba(255,241,205,0.16)",
                borderRadius: 999,
                paddingLeft: 14,
                paddingRight: 14,
                paddingTop: 8,
                paddingBottom: 8,
              }}
            >
              About Popcorn
              <ChevronRight className="w-3.5 h-3.5" style={{ color: "rgba(255,241,205,0.50)" }} strokeWidth={2} />
            </button>
          </div>

          {/* Legal — stacked rows with chevrons */}
          <div className="px-5 mb-6">
            <div style={{ height: "1px", background: "rgba(255,241,205,0.08)", marginBottom: 16 }} />
            <p style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "12px", color: "#fff1cd", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
              Legal
            </p>
            <div
              style={{
                borderRadius: 16,
                background: "rgba(255,241,205,0.05)",
                border: "1px solid rgba(255,241,205,0.10)",
                overflow: "hidden",
              }}
            >
              <LegalRow label="Privacy Policy" onClick={() => onOpenLegal("privacy")} />
              <div style={{ height: 1, background: "rgba(255,241,205,0.08)" }} />
              <LegalRow label="Terms & Conditions" onClick={() => onOpenLegal("terms")} />
              <div style={{ height: 1, background: "rgba(255,241,205,0.08)" }} />
              <LegalRow
                label="Contact us"
                onClick={() => { window.location.href = "mailto:hello@popcornmedia.org"; }}
              />
            </div>
          </div>

          {/* Version */}
          <div className="px-5 mb-6">
            <p className="font-['Inter']" style={{ fontSize: "11px", color: "rgba(255,241,205,0.32)", letterSpacing: "0.04em" }}>
              Version {APP_VERSION}
            </p>
          </div>

          {/* Sign out — subtle text link */}
          <div className="mt-auto px-5">
            <div style={{ height: "1px", background: "rgba(255,241,205,0.08)", marginBottom: 16 }} />
            <button
              onClick={onSignOut}
              className="flex items-center gap-2 font-['Inter'] transition-opacity hover:opacity-60 active:opacity-50"
              style={{ fontSize: "12px", color: "rgba(255,241,205,0.38)", letterSpacing: "0.02em" }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      ) : (
        /* ── Signed-out view ── */
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-8 text-center">
            <div style={{
              width: 80, height: 80, borderRadius: "50%", marginBottom: 24,
              background: "rgba(255,241,205,0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,241,205,0.22)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <User className="w-8 h-8" style={{ color: "#fff1cd", strokeWidth: 1.5 }} />
            </div>

            <h1 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "18px", lineHeight: 1, color: "#fff1cd", letterSpacing: "0.02em", marginBottom: 10 }}>
              Your Profile
            </h1>
            <p className="font-['Manrope'] leading-relaxed" style={{ fontSize: "14px", color: "rgba(255,241,205,0.48)", maxWidth: 260, marginBottom: 28 }}>
              Sign in to personalise your feed and keep your reading history in sync.
            </p>

            <div className="flex flex-col gap-3 w-full" style={{ maxWidth: 280 }}>
              <button
                onClick={onSignIn}
                className="w-full py-3.5 rounded-full font-['Inter'] font-semibold text-sm tracking-wide transition-opacity hover:opacity-85"
                style={{ background: "#fff1cd", color: "#053980" }}
              >
                Sign in
              </button>
              <button
                onClick={onCreateAccount}
                className="w-full py-3.5 rounded-full font-['Inter'] font-semibold text-sm tracking-wide transition-opacity hover:opacity-85"
                style={{ background: "rgba(255,241,205,0.09)", color: "#fff1cd", border: "1px solid rgba(255,241,205,0.14)" }}
              >
                Create account
              </button>
            </div>
        </div>
      )}
    </div>
  );
}

export function FeedPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const userName = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? null;
  const userEmail = user?.email ?? null;
  const userAvatar = user?.user_metadata?.avatar_url ?? null;
  const userTopics: string[] = user?.user_metadata?.topics ?? [];

  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [readingArticle, setReadingArticle] = useState<NewsArticle | null>(null);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [signUpOpen, setSignUpOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [legalSheet, setLegalSheet] = useState<LegalKind | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  // Deep-link target for opening the comment sheet pre-scrolled to a reply
  // (set when the user taps a notification row).
  const [readerCommentsOpen, setReaderCommentsOpen] = useState(false);
  const [focusCommentId, setFocusCommentId] = useState<number | null>(null);
  const { items: notifItems, unreadCount, loading: notifLoading, markRead, markAllRead } = useNotifications(user);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Pull-to-refresh ─────────────────────────────────────────────────────
  const [pullOffset, setPullOffset] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartY = useRef<number | null>(null);
  const isPulling = useRef(false);

  // Measure the true full-viewport height in pixels by reading CSS 100dvh.
  //
  // On iOS standalone PWA, window.innerHeight and el.clientHeight can be
  // SHORTER than the actual visual viewport (they exclude the home indicator
  // safe area even with viewport-fit=cover). But CSS 100dvh always resolves
  // to the full screen height. We measure it via a hidden element, then use
  // that pixel value for card sizing so images bleed edge-to-edge.
  const [viewportHeight, setViewportHeight] = useState(() => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:0;height:100dvh;pointer-events:none;visibility:hidden';
    document.body.appendChild(d);
    const h = d.offsetHeight;
    d.remove();
    return h > 0 ? h : window.innerHeight;
  });
  useEffect(() => {
    const measure = () => {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;top:0;height:100dvh;pointer-events:none;visibility:hidden';
      document.body.appendChild(d);
      const h = d.offsetHeight;
      d.remove();
      setViewportHeight(h > 0 ? h : window.innerHeight);
    };
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Close auth modals when the user becomes authenticated (e.g. after Google OAuth redirect)
  useEffect(() => {
    if (user) { setChoiceOpen(false); setSignUpOpen(false); setSignInOpen(false); }
  }, [user]);

  // True while the user sees intro/auth chrome (splash, account-choice,
  // sign-up, sign-in). These screens use the branded blue background.
  // Everything else (feed, saved, profile, article reader, comments) uses
  // black so no blue hue leaks through at the bottom safe-area strip.
  const isIntroScreen = showSplash || choiceOpen || signUpOpen || signInOpen;

  // Dynamic theme-color + html background based on active screen.
  // On iOS standalone PWA, position:fixed bottom:0 stops at the safe-area
  // boundary — the ~34px home indicator strip can only show the html
  // element's background. We match it to the screen content so the
  // strip is invisible.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const isDark = readingArticle || (activeTab === 'feed' && !showSplash);
    const color = isDark ? '#000000' : '#053980';
    if (meta) meta.content = color;
    document.documentElement.style.background = color;
  }, [readingArticle, activeTab, showSplash]);

  const handleSplashDone = useCallback(() => setShowSplash(false), []);

  // ── Notifications ───────────────────────────────────────────────────────
  // Opening the sheet immediately marks all notifications read — the red dot
  // clears right away and the sheet acts as the inbox view.
  const openNotifications = useCallback(() => {
    setNotifOpen(true);
    void markAllRead();
  }, [markAllRead]);

  // Tapping a notification row: mark it read, fetch the article, open the
  // reader with the comments sheet pre-open and scrolled to the reply.
  const handleSelectNotification = useCallback(async (n: { id: number; article_id: number; reply_comment_id: number }) => {
    void markRead(n.id);
    setNotifOpen(false);
    const { data } = await supabase
      .from("articles")
      .select("*")
      .eq("id", n.article_id)
      .single();
    if (!data) return;
    setFocusCommentId(n.reply_comment_id);
    setReaderCommentsOpen(true);
    setReadingArticle(data as unknown as NewsArticle);
  }, [markRead]);

  const pickerTouchStartYRef = useRef(0);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status, refetch } =
    useInfiniteNewsFeed(undefined);

  // ── Pull-to-refresh handlers ────────────────────────────────────────────
  const handlePullStart = useCallback((e: React.TouchEvent) => {
    const container = scrollContainerRef.current;
    if (!container || isRefreshing) return;
    // Only activate when scrolled to the very top (on the first date divider)
    if (container.scrollTop > 4) return;
    pullStartY.current = e.touches[0].clientY;
    isPulling.current = false;
  }, [isRefreshing]);

  const handlePullMove = useCallback((e: React.TouchEvent) => {
    if (pullStartY.current === null || isRefreshing) return;
    const container = scrollContainerRef.current;
    // Bail if user scrolled away from top during the touch
    if (container && container.scrollTop > 4) {
      pullStartY.current = null;
      setPullOffset(0);
      return;
    }
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta <= 0) { setPullOffset(0); return; }
    if (!isPulling.current && delta < 10) return;
    isPulling.current = true;
    // Damped pull — sqrt resistance so it feels elastic
    const dampened = Math.sqrt(delta) * 6;
    setPullOffset(Math.min(dampened, 120));
  }, [isRefreshing]);

  const handlePullEnd = useCallback(() => {
    if (pullStartY.current === null) return;
    pullStartY.current = null;
    if (pullOffset > 60 && !isRefreshing) {
      setIsRefreshing(true);
      setPullOffset(72); // hold tall enough so the full popcorn SVG is visible
      // Always show the popcorn animation for at least 1.8s — branded moment
      const minDelay = new Promise(r => setTimeout(r, 1800));
      Promise.all([refetch(), minDelay]).finally(() => {
        setIsRefreshing(false);
        setPullOffset(0);
      });
    } else {
      setPullOffset(0);
    }
    isPulling.current = false;
  }, [pullOffset, isRefreshing, refetch]);


  useEffect(() => {
    document.body.style.overflow = readingArticle ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [readingArticle]);

  // Memoised so `feedItems` useMemo only recomputes when React Query actually
  // fetches new data — not on every render (flatMap always returns a new array).
  // Image URLs are rewritten through optimizeImageUrl() here so that every
  // downstream consumer (ArticleCard, ArticleReader, SavedScreen, the rAF
  // prefetcher) sees the same viewport-sized URL — this guarantees the
  // browser's decoded-image cache actually hits when the <img> tag mounts.
  const allArticles = useMemo(
    () => (data?.pages.flatMap((page) => page.articles) ?? []).map((article) => {
      const optimized = optimizeImageUrl(article.imageUrl);
      return optimized === article.imageUrl
        ? article
        : { ...article, imageUrl: optimized as typeof article.imageUrl };
    }),
    [data]
  );
  const savedArticles = allArticles.filter((a) => a.isBookmarked);
  const liveReadingArticle = readingArticle
    ? (allArticles.find((a) => a.id === readingArticle.id) ?? readingArticle)
    : null;

  type FeedItem =
    | { kind: "article"; article: NewsArticle }
    | { kind: "divider"; date: Date; id: string };

  const feedItems = useMemo<FeedItem[]>(() => {
    if (allArticles.length === 0) return [];
    const items: FeedItem[] = [];
    let lastDayKey: string | null = null;
    for (const article of allArticles) {
      // Use feedDate (curation date) for dividers; fall back to publishedAt
      const dateStr = (article as any).feedDate ?? article.publishedAt;
      const dayKey = startOfDay(new Date(dateStr)).toISOString();
      if (lastDayKey !== dayKey) {
        const divDate = startOfDay(new Date(dateStr));
        items.push({ kind: "divider", date: divDate, id: dividerIdForDate(divDate) });
      }
      lastDayKey = dayKey;
      items.push({ kind: "article", article });
    }
    return items;
  }, [allArticles]);

  // Ref forwarded to TopBar's fill div — mutated directly by the rAF loop, never by React
  const feedBarFillRef = useRef<HTMLDivElement>(null);
  // Last progress value written — skip DOM write when unchanged (< 0.001 delta)
  const lastProgressRef = useRef(-1);

  // Prevents scroll-based date updates from overriding an explicit picker selection
  const pickerNavLockRef = useRef(false);

  // Divider positions within feedItems — kept in a ref so the rAF loop can read
  // them without being a React dep (avoids tearing down/recreating the loop).
  const dividerIndicesRef = useRef<number[]>([]);
  useEffect(() => {
    dividerIndicesRef.current = feedItems
      .map((item, i) => (item.kind === 'divider' ? i : -1))
      .filter((i) => i >= 0);
  }, [feedItems]);

  // feedItems exposed as a ref so the rAF loop can read the latest list (for
  // prefetching next-card image URLs) without being a React dep of the loop.
  const feedItemsDataRef = useRef<FeedItem[]>(feedItems);
  useEffect(() => { feedItemsDataRef.current = feedItems; }, [feedItems]);

  const feedItemsLengthRef = useRef(feedItems.length);
  useEffect(() => { feedItemsLengthRef.current = feedItems.length; }, [feedItems.length]);

  // Last rounded card index the rAF loop saw. -1 so the very first tick always
  // fires setCurrentCardIndex + the initial prefetch pass.
  const scrollIndexRef = useRef(-1);

  // Keeps decoded Image references alive so the browser's internal pixel
  // buffer cache doesn't evict them under memory pressure. This is the
  // single most important trick for TikTok/Instagram-grade transitions: the
  // moment React mounts an <img> with the same src, the browser reuses the
  // already-decoded pixel buffer and paints it to screen synchronously
  // (no fetch, no decode, no flash).
  //
  // LRU-bounded at MAX_DECODED_IMAGES. On mobile each 1080px JPEG is ~2MB
  // decoded, so a budget of 20 keeps image memory under ~40MB. We need at
  // least (render window ±3 = 7) + (prefetch ahead 6) + (behind 2) ≈ 15,
  // so 20 gives headroom for direction changes without evicting live cards.
  const decodedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const decodeOrderRef   = useRef<string[]>([]);
  const MAX_DECODED_IMAGES = 20;

  // Pre-fetch AND pre-decode an image. Fire and forget — the decoded buffer
  // is retained in the JS Map reference until the LRU evicts it. If decode
  // fails (CORS, unsupported format, network error), the entry is removed
  // so the normal <img> path can retry.
  const preloadImage = useCallback((url: string | null | undefined, priority: 'high' | 'auto' = 'auto') => {
    if (!url || decodedImagesRef.current.has(url)) return;

    const img = new Image();
    // fetchPriority is a relatively new HTMLImageElement prop; TS lib doesn't
    // always know about it. Cast and assign for Chrome/Safari 17+ support.
    (img as unknown as { fetchPriority?: string }).fetchPriority = priority;
    img.decoding = 'async';
    img.src = url;

    decodedImagesRef.current.set(url, img);
    decodeOrderRef.current.push(url);

    // Force decode off the main thread. On success the decoded frame sits in
    // the browser's memory cache and any later <img src={url}> paints it
    // instantly. On failure we drop the entry so the normal path can retry.
    img.decode().catch(() => {
      decodedImagesRef.current.delete(url);
    });

    // LRU eviction. Never evict the URL we just inserted.
    while (decodeOrderRef.current.length > MAX_DECODED_IMAGES) {
      const evict = decodeOrderRef.current.shift();
      if (evict && evict !== url) decodedImagesRef.current.delete(evict);
    }
  }, []);

  // ── Shared progress-bar updater ─────────────────────────────────────────────
  // Pure function that reads scrollTop and writes a scaleX transform to the
  // fill div.  Called from TWO sites (both idempotent — same input → same DOM
  // write, so running both never conflicts):
  //   • A passive `scroll` listener — fires on every compositor frame,
  //     including during CSS scroll-snap animations (where rAF can stall).
  //   • The rAF loop — provides a baseline on initial load and for any
  //     edge cases where a scroll event might not fire.
  const updateProgressBar = useCallback(() => {
    const container = scrollContainerRef.current;
    const fill = feedBarFillRef.current;
    if (!container || !fill) return;
    const { scrollTop, clientHeight } = container;
    const totalItems = feedItemsLengthRef.current;
    if (clientHeight <= 0 || totalItems <= 0) return;

    const fractionalIdx = scrollTop / clientHeight;
    const dividers = dividerIndicesRef.current;
    let sectionStart = 0;
    let sectionEnd = totalItems;
    for (let i = 0; i < dividers.length; i++) {
      if (dividers[i] <= fractionalIdx) {
        sectionStart = dividers[i];
        sectionEnd = dividers[i + 1] ?? totalItems;
      }
    }
    const sectionLength = sectionEnd - sectionStart;
    const denom = sectionLength > 1 ? sectionLength - 1 : 1;
    const rawProgress = (fractionalIdx - sectionStart) / denom;
    const progress = Math.round(Math.max(0, Math.min(1, rawProgress)) * 1000) / 1000;
    if (Math.abs(progress - lastProgressRef.current) > 0.0005) {
      lastProgressRef.current = progress;
      fill.style.transform = `scaleX(${progress})`;
    }
  }, []);

  // ── Scroll listener — catches snap-animation frames that rAF misses ───────
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.addEventListener('scroll', updateProgressBar, { passive: true });
    return () => container.removeEventListener('scroll', updateProgressBar);
  }, [updateProgressBar]);

  // ── Unified rAF loop: progress bar + card tracking + image prefetch ────────
  useEffect(() => {
    let rafId: number;
    const loop = () => {
      const container = scrollContainerRef.current;
      if (container) {
        const { scrollTop, clientHeight } = container;
        const totalItems = feedItemsLengthRef.current;

        if (clientHeight > 0 && totalItems > 0) {
          // Progress bar — baseline update (scroll listener also calls this
          // during snap animations for zero-gap coverage).
          updateProgressBar();

          const fractionalIdx = scrollTop / clientHeight;
          const roundedIdx = Math.min(
            Math.max(0, Math.round(fractionalIdx)),
            totalItems - 1,
          );

          // Card transition — runs once per index change.
          if (roundedIdx !== scrollIndexRef.current) {
            scrollIndexRef.current = roundedIdx;

            // Functional updater so React bails out if the value is unchanged
            // (e.g. initial load when state already happens to equal 0).
            setCurrentCardIndex(prev => (prev === roundedIdx ? prev : roundedIdx));

            // Prefetch + pre-decode the next 6 images. The nearest two get
            // fetchPriority=high so the network stack fetches them first on
            // mobile, which matters on fast flicks when the user jumps 3+
            // cards in a single momentum scroll. Images 3-6 fill the buffer
            // ahead of the render window so even sustained rapid scrolling
            // never outruns the decode pipeline. We also warm the next 2
            // behind the cursor so back-scroll is instant too.
            const items = feedItemsDataRef.current;
            for (let offset = 1; offset <= 6; offset++) {
              const item = items[roundedIdx + offset];
              if (item?.kind === 'article' && item.article.imageUrl) {
                preloadImage(item.article.imageUrl, offset <= 2 ? 'high' : 'auto');
              }
            }
            for (let offset = 1; offset <= 2; offset++) {
              const item = items[roundedIdx - offset];
              if (item?.kind === 'article' && item.article.imageUrl) {
                preloadImage(item.article.imageUrl, 'auto');
              }
            }
          }
        }
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [preloadImage, updateProgressBar]);

  // ── Initial prefetch pass as soon as the first page of articles arrives ─────
  // The rAF loop will ALSO prefetch on its first tick, but that's one frame
  // later. Firing synchronously here makes the very first few cards load
  // without a perceptible fetch delay even on cold navigation. The first 3
  // get high priority so the network stack processes them before anything
  // else on the page.
  useEffect(() => {
    if (feedItems.length === 0) return;
    for (let i = 0; i < Math.min(6, feedItems.length); i++) {
      const item = feedItems[i];
      if (item.kind === 'article' && item.article.imageUrl) {
        preloadImage(item.article.imageUrl, i < 3 ? 'high' : 'auto');
      }
    }
  }, [feedItems, preloadImage]);

  // ── Task 2: Date sync on card change ─────────────────────────────────────────
  // Uses functional updater with isSameDay guard so React bails out when the
  // date hasn't actually changed — prevents re-renders on same-day Date objects.
  useEffect(() => {
    if (pickerNavLockRef.current) return;
    const item = feedItems[currentCardIndex];
    let newDate: Date | null = null;
    if (item?.kind === 'article') newDate = startOfDay(new Date((item.article as any).feedDate ?? item.article.publishedAt));
    else if (item?.kind === 'divider') newDate = item.date;
    if (newDate) setSelectedDate(prev => isSameDay(prev, newDate!) ? prev : newDate!);
  }, [currentCardIndex, feedItems]);

  // ── Pagination: fetch next page when 5 cards from the end ───────────────────
  // The scroll-based fetchNextPage trigger was removed in the IO refactor;
  // this replaces it using currentCardIndex so yesterday's articles still load.
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    if (currentCardIndex >= feedItems.length - 5) {
      fetchNextPage();
    }
  }, [currentCardIndex, feedItems.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Dynamic min date — based on the oldest article actually available in the feed.
  // Falls back to yesterday if no articles are loaded yet.
  const minDate = useMemo(() => {
    if (allArticles.length === 0) return startOfDay(subDays(new Date(), 1));
    const oldest = allArticles.reduce((min, a) => {
      const d = new Date((a as any).feedDate ?? a.publishedAt);
      return d < min ? d : min;
    }, new Date((allArticles[0] as any).feedDate ?? allArticles[0].publishedAt));
    return startOfDay(oldest);
  }, [allArticles]);

  // ── Crossfade jump helper ────────────────────────────────────────────────
  // Short hops (≤ 3 cards) use native smooth-scroll. Longer jumps crossfade
  // the feed container to avoid the jarring stutter of scrolling through many
  // snap points. The progress bar gets a brief CSS transition so it glides to
  // its new position instead of snapping.
  const crossfadeJump = useCallback((targetTop: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distance = Math.abs(container.scrollTop - targetTop);

    if (distance <= viewportHeight * 3) {
      container.scrollTo({ top: targetTop, behavior: "smooth" });
      return;
    }

    // Long jump — crossfade for a seamless feel
    const fill = feedBarFillRef.current;
    if (fill) fill.style.transition = 'transform 0.35s ease';

    container.style.transition = 'opacity 0.14s ease-out';
    container.style.opacity = '0';

    setTimeout(() => {
      container.scrollTo({ top: targetTop, behavior: "instant" as ScrollBehavior });
      container.style.transition = 'opacity 0.22s ease-in';
      container.style.opacity = '1';
      setTimeout(() => {
        container.style.transition = '';
        // Remove transition so scroll/rAF drives the bar directly
        if (fill) fill.style.transition = 'none';
      }, 260);
    }, 150);
  }, [viewportHeight]);

  const handleDatePick = useCallback((date: Date) => {
    pickerNavLockRef.current = true;
    setTimeout(() => { pickerNavLockRef.current = false; }, 700);
    const d = startOfDay(date);
    setSelectedDate(d);
    if (isSameDay(d, startOfDay(new Date()))) {
      crossfadeJump(0);
      return;
    }
    // Index-based scrollTo — reliable in snap containers; scrollIntoView is not.
    const dividerIdx = feedItems.findIndex(
      (item) => item.kind === 'divider' && isSameDay(item.date, d)
    );
    if (dividerIdx !== -1) {
      crossfadeJump(dividerIdx * viewportHeight);
    }
  }, [feedItems, viewportHeight, crossfadeJump]);

  // Tap-top handler — two behaviours based on where the user currently is:
  //
  //   • On an article card  → scroll to the CURRENT day's DateDivider (the
  //     top of the current day section). This matches the iOS "tap status
  //     bar to scroll to top" convention.
  //
  //   • On a DateDivider    → scroll to the NEXT newer day's DateDivider
  //     (smaller index in the newest-first feed). Lets the user walk the
  //     day-dividers without having to scroll through an entire day's
  //     worth of articles. If already on the newest divider, no-op.
  const handleScrollToDayTop = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const currentIndex = Math.round(container.scrollTop / viewportHeight);
    const dividers = dividerIndicesRef.current;
    if (dividers.length === 0) return;

    // Are we currently parked on a divider card?
    const isOnDivider = dividers.includes(currentIndex);

    let targetIdx: number;
    if (isOnDivider) {
      // Walk backwards through the dividers list to find the nearest one
      // with a smaller index (newer date in the newest-first feed ordering).
      let prev = -1;
      for (let i = 0; i < dividers.length; i++) {
        if (dividers[i] < currentIndex) prev = dividers[i];
        else break;
      }
      if (prev === -1) return; // already at the newest divider
      targetIdx = prev;
    } else {
      // Find the largest divider index ≤ current → start of current day.
      let sectionStart = dividers[0];
      for (let i = 0; i < dividers.length; i++) {
        if (dividers[i] <= currentIndex) sectionStart = dividers[i];
      }
      targetIdx = sectionStart;
    }

    const target = targetIdx * viewportHeight;
    if (Math.abs(container.scrollTop - target) < 8) return;
    crossfadeJump(target);
  }, [viewportHeight, crossfadeJump]);

  if (status === "pending") {
    return (
      <div className="pn-fullscreen fixed inset-0 overflow-hidden" style={{ background: '#053980' }}>
        <GrainBackground />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="pn-fullscreen fixed inset-0 flex flex-col items-center justify-center p-8 text-center overflow-hidden" style={{ background: '#053980' }}>
        <GrainBackground />
        <AlertCircle className="w-10 h-10 text-red-400 mb-6" />
        <h2 className="font-['Manrope'] font-bold text-2xl mb-3" style={{ color: "#fff1cd" }}>Connection lost</h2>
        <p className="font-['Inter'] mb-8 max-w-xs" style={{ color: "rgba(255,241,205,0.65)" }}>
          We couldn't reach the Pulse network. Check your connection and try again.
        </p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-['Inter'] font-semibold text-sm"
          style={{ background: "#fff1cd", color: "#053980" }}
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  const renderOverlayTab = () => {
    if (activeTab === "saved") return <SavedScreen onBrowse={() => setActiveTab("feed")} articles={savedArticles} onReadMore={setReadingArticle} />;
    if (activeTab === "profile") return (
      <ProfileScreen
        onSignIn={() => setSignInOpen(true)}
        onCreateAccount={() => setChoiceOpen(true)}
        onSignOut={() => { signOut(); setActiveTab("feed"); setShowSplash(true); }}
        onOpenLegal={setLegalSheet}
        onOpenNotifications={openNotifications}
        unreadCount={unreadCount}
        userName={userName}
        userEmail={userEmail}
        userAvatar={userAvatar}
        topics={userTopics}
      />
    );
    return null;
  };

  return (
    <div className="pn-fullscreen fixed inset-0" style={{ background: '#053980' }}>
      {/* Persistent grain behind all fixed content — covers full viewport
          including bottom safe area so the home indicator region shows grain,
          not a flat color that causes rainbow banding. Splash has its own
          canvas so skip during splash to avoid double-compositing. */}
      <GrainBackground />

      {showSplash && (
        <SplashScreen
          onDone={handleSplashDone}
          authLoading={authLoading}
          isAuthed={!!user}
          onCreateAccount={() => setChoiceOpen(true)}
          onSignIn={() => setSignInOpen(true)}
          onOpenLegal={setLegalSheet}
        />
      )}
      {activeTab === 'feed' && !isIntroScreen && <TopBar selectedDate={selectedDate} onDateChange={handleDatePick} showDatePicker fillRef={feedBarFillRef} minDate={minDate} pickerOpen={pickerOpen} onPickerOpenChange={setPickerOpen} onScrollToDayTop={handleScrollToDayTop} />}

      {/* Picker dismiss overlay — lives here so it can forward scroll gestures to the feed */}
      {pickerOpen && activeTab === 'feed' && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 38 }}
          onClick={() => setPickerOpen(false)}
          onWheel={(e) => {
            setPickerOpen(false);
            const container = scrollContainerRef.current;
            if (!container) return;
            const currentIndex = Math.round(container.scrollTop / window.innerHeight);
            const targetIndex = e.deltaY > 0 ? currentIndex + 1 : Math.max(0, currentIndex - 1);
            container.scrollTo({ top: targetIndex * window.innerHeight, behavior: 'smooth' });
          }}
          onTouchStart={(e) => {
            pickerTouchStartYRef.current = e.touches[0].clientY;
          }}
          onTouchMove={(e) => {
            const dy = pickerTouchStartYRef.current - e.touches[0].clientY;
            if (Math.abs(dy) > 8) {
              setPickerOpen(false);
              const container = scrollContainerRef.current;
              if (!container) return;
              const currentIndex = Math.round(container.scrollTop / window.innerHeight);
              const targetIndex = dy > 0 ? currentIndex + 1 : Math.max(0, currentIndex - 1);
              container.scrollTo({ top: targetIndex * window.innerHeight, behavior: 'smooth' });
            }
          }}
        />
      )}

      {/* Pull-to-refresh indicator — popcorn SVG sits below the TopBar,
           just above the date divider / first card. Uses bottom-alignment
           so the animation emerges from under the TopBar as you pull. */}
      {activeTab === 'feed' && (pullOffset > 0 || isRefreshing) && (
        <div
          style={{
            position: 'fixed',
            top: 'calc(56px + env(safe-area-inset-top))',
            left: 0,
            right: 0,
            height: pullOffset,
            zIndex: 35,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 12,
            overflow: 'hidden',
            pointerEvents: 'none',
            transition: isPulling.current ? 'none' : 'height 0.3s cubic-bezier(0.32,0.72,0,1)',
          }}
        >
          <div style={{
            opacity: Math.min(1, pullOffset / 35),
            transform: `scale(${Math.min(1, pullOffset / 45)})`,
            transition: 'transform 0.15s ease-out, opacity 0.15s ease-out',
          }}>
            <PopcornRefreshAnim active={isRefreshing || pullOffset > 35} />
          </div>
        </div>
      )}

      {/* Feed — position:fixed inset:0 guarantees true full visual-viewport on all mobile browsers.
           Always mounted so scroll position is preserved when switching tabs. */}
      <div
        ref={scrollContainerRef}
        onTouchStart={handlePullStart}
        onTouchMove={handlePullMove}
        onTouchEnd={handlePullEnd}
        className="pn-fullscreen snap-y snap-mandatory scrollbar-hide"
        style={{
          position: 'fixed',
          top: pullOffset,
          left: 0,
          right: 0,
          bottom: 0,
          overflowY: 'auto',
          overscrollBehavior: 'none',
          WebkitOverflowScrolling: 'touch',
          display: activeTab === 'feed' ? 'block' : 'none',
          background: '#000',
          transition: isPulling.current ? 'none' : 'top 0.3s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {feedItems.length === 0 ? (
          <div className="relative w-full flex flex-col items-center justify-center snap-start snap-always text-center px-6 overflow-hidden" style={{ height: viewportHeight }}>
            <GrainBackground />
            <h2 className="font-['Manrope'] font-bold text-2xl mb-2" style={{ color: "#fff1cd" }}>
              You're all caught up
            </h2>
            <p className="font-['Manrope'] italic" style={{ color: "rgba(255,241,205,0.65)" }}>
              No more stories right now — check back soon.
            </p>
          </div>
        ) : (
          feedItems.map((item, index) => {
            // 7-card render window (±3 from current): the neighbours
            // already have their <img> in the DOM so decode starts before
            // the user reaches them. Everything outside the window is a
            // same-height empty div — no image tags, no decode work,
            // minimal memory footprint for iOS WebViews. Combined with
            // the rAF-driven prefetch (next 6 + prev 2 URLs pre-decoded),
            // this gives seamless transitions even on fast flicks.
            //
            // Why ±3 and not ±2: on fast flicks the browser's decode-cache
            // reuse on iOS Safari is unreliable — having the <img> already
            // in the DOM guarantees the pixels are ready to composite when
            // the user reaches the card.
            const renderContent = Math.abs(index - currentCardIndex) <= 3;
            const isActive = index === currentCardIndex;
            return item.kind === "divider" ? (
              <DateDividerCard
                key={item.id}
                date={item.date}
                dateId={item.id}
                viewportHeight={viewportHeight}
              />
            ) : (
              <ArticleCard
                key={item.article.id}
                article={item.article}
                onReadMore={setReadingArticle}
                isRead={readIds.has(item.article.id)}
                viewportHeight={viewportHeight}
                renderContent={renderContent}
                isActive={isActive}
              />
            );
          })
        )}
      </div>

      {/* Overlay screens for other tabs */}
      {renderOverlayTab()}

      {!isIntroScreen && <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />}
      <ArticleReader
        article={liveReadingArticle}
        onClose={() => { setReadingArticle(null); setReaderCommentsOpen(false); setFocusCommentId(null); }}
        isRead={liveReadingArticle ? readIds.has(liveReadingArticle.id) : false}
        onMarkRead={() => liveReadingArticle && setReadIds(prev => {
          const next = new Set(prev);
          next.has(liveReadingArticle.id) ? next.delete(liveReadingArticle.id) : next.add(liveReadingArticle.id);
          return next;
        })}
        initialCommentsOpen={readerCommentsOpen}
        focusCommentId={focusCommentId}
        onRequireAuth={() => setSignInOpen(true)}
      />
      <AccountChoiceSheet
        isOpen={choiceOpen}
        onClose={() => setChoiceOpen(false)}
        onCreateManually={() => setSignUpOpen(true)}
      />
      <SignUpFlow
        isOpen={signUpOpen}
        onClose={() => setSignUpOpen(false)}
        onComplete={() => setSignUpOpen(false)}
        onOpenLegal={setLegalSheet}
        onSignInInstead={(email) => { setSignInEmail(email); setSignInOpen(true); }}
      />
      <SignInSheet
        isOpen={signInOpen}
        onClose={() => { setSignInOpen(false); setSignInEmail(""); }}
        onSignUpInstead={() => { setSignInOpen(false); setSignInEmail(""); setSignUpOpen(true); }}
        onOpenLegal={setLegalSheet}
        initialEmail={signInEmail}
      />

      {/* Privacy / Terms sheet — reachable from the splash CTAs,
          SignUp/SignIn flows, and the Profile tab. */}
      <LegalSheet kind={legalSheet} onClose={() => setLegalSheet(null)} />

      {/* Reply notifications — opened from the popcorn icon on the profile. */}
      <NotificationsSheet
        isOpen={notifOpen}
        items={notifItems}
        loading={notifLoading}
        onClose={() => setNotifOpen(false)}
        onSelect={handleSelectNotification}
      />
    </div>
  );
}
