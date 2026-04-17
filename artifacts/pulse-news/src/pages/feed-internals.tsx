// Duplicated helpers for the horizontal feed experiment. Kept in a
// separate file so the original FeedPage.tsx is not touched — reverting
// to the legacy vertical feed is a single-line import swap in App.tsx.
// When the new feed is promoted, these can be deduped with FeedPage's
// inline copies.

import { Bookmark, User, LogOut, ChevronRight } from "lucide-react";
import type { NewsArticle } from "@workspace/api-client-react";
import { GrainBackground } from "@/components/GrainBackground";
import { PopcornIcon } from "@/components/PopcornIcon";
import type { LegalKind } from "@/components/LegalSheet";

export const APP_VERSION = "1.0.0";

// ── Image URL optimisation — same 1080px target as FeedPage.tsx ─────────
export const TARGET_IMAGE_WIDTH = 1080;

export function optimizeImageUrl(url: string | null | undefined): string | null | undefined {
  if (!url || typeof url !== 'string') return url;
  const isWpImg =
    /\/wp-content\/uploads\//i.test(url) &&
    /\.(jpe?g|png)(\?|$)/i.test(url);
  if (isWpImg && !/[?&]w=\d+/i.test(url)) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}w=${TARGET_IMAGE_WIDTH}`;
  }
  return url;
}

export const CATEGORY_COLORS: Record<string, string> = {
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

// ── Pull-to-refresh popcorn anim — identical to FeedPage's local copy ───
export function PopcornRefreshAnim({ active, size = 80 }: { active: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <radialGradient id="ptrh-halo-grad" cx="0.5" cy="0.58" r="0.5">
          <stop offset="0%"   stopColor="#fff1cd" stopOpacity="0.42" />
          <stop offset="55%"  stopColor="#fff1cd" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#fff1cd" stopOpacity="0" />
        </radialGradient>
        <filter id="ptrh-halo-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      {active && (
        <style>{`
          @keyframes ptrh-a { 0%,100% { transform: translateY(0) scaleY(1) scaleX(1); } 20% { transform: translateY(2px) scaleY(0.88) scaleX(1.1); } 50% { transform: translateY(-11px) scaleY(1.12) scaleX(0.91); } 75% { transform: translateY(-8px) scaleY(1.06) scaleX(0.96); } }
          @keyframes ptrh-b { 0%,100% { transform: translateY(0) scaleY(1) scaleX(1); } 20% { transform: translateY(2px) scaleY(0.85) scaleX(1.12); } 50% { transform: translateY(-15px) scaleY(1.14) scaleX(0.89); } 75% { transform: translateY(-10px) scaleY(1.07) scaleX(0.95); } }
          @keyframes ptrh-c { 0%,100% { transform: translateY(0) scaleY(1) scaleX(1); } 20% { transform: translateY(2px) scaleY(0.9) scaleX(1.08); } 50% { transform: translateY(-10px) scaleY(1.1) scaleX(0.92); } 75% { transform: translateY(-7px) scaleY(1.05) scaleX(0.97); } }
          .ptrh-pa { animation: ptrh-a 1.15s cubic-bezier(0.34,1.5,0.64,1) infinite; transform-box: fill-box; transform-origin: center 90%; }
          .ptrh-pb { animation: ptrh-b 1.15s cubic-bezier(0.34,1.5,0.64,1) infinite 0.20s; transform-box: fill-box; transform-origin: center 90%; }
          .ptrh-pc { animation: ptrh-c 1.15s cubic-bezier(0.34,1.5,0.64,1) infinite 0.40s; transform-box: fill-box; transform-origin: center 90%; }
          @keyframes ptrh-rumble { 0%,100% { transform: none; } 20% { transform: translateX(-1.2px) rotate(-0.3deg); } 50% { transform: translateX(1.2px) rotate(0.3deg); } 80% { transform: translateX(-0.6px); } }
          .ptrh-bucket { animation: ptrh-rumble 0.38s ease-in-out infinite; transform-box: fill-box; transform-origin: center 50%; }
          @keyframes ptrh-heat { 0%,100% { opacity: 0.12; } 50% { opacity: 0.28; } }
          .ptrh-heat { animation: ptrh-heat 0.95s ease-in-out infinite; }
          @keyframes ptrh-halo { 0%,100% { opacity: 0.75; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
          .ptrh-halo { animation: ptrh-halo 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center 60%; }
          @keyframes ptrh-k1 { 0% { transform: translate(0,0) rotate(0deg) scale(0); opacity: 0; } 8% { transform: translate(-3px,-5px) rotate(40deg) scale(1); opacity: 1; } 55% { transform: translate(-22px,-32px) rotate(210deg) scale(0.95); opacity: 1; } 80% { transform: translate(-24px,-20px) rotate(300deg) scale(0.5); opacity: 0.4; } 100% { transform: translate(-26px,-10px) rotate(360deg) scale(0.1); opacity: 0; } }
          @keyframes ptrh-k2 { 0% { transform: translate(0,0) rotate(0deg) scale(0); opacity: 0; } 8% { transform: translate(3px,-5px) rotate(-40deg) scale(1); opacity: 1; } 55% { transform: translate(20px,-34px) rotate(-200deg) scale(0.95); opacity: 1; } 80% { transform: translate(22px,-22px) rotate(-290deg) scale(0.5); opacity: 0.4; } 100% { transform: translate(24px,-12px) rotate(-355deg) scale(0.1); opacity: 0; } }
          @keyframes ptrh-k3 { 0% { transform: translate(0,0) rotate(0deg) scale(0); opacity: 0; } 8% { transform: translate(-1px,-7px) rotate(70deg) scale(1); opacity: 1; } 55% { transform: translate(-6px,-40px) rotate(235deg) scale(0.95); opacity: 1; } 80% { transform: translate(-7px,-28px) rotate(325deg) scale(0.5); opacity: 0.3; } 100% { transform: translate(-8px,-18px) rotate(390deg) scale(0.1); opacity: 0; } }
          @keyframes ptrh-k4 { 0% { transform: translate(0,0) rotate(0deg) scale(0); opacity: 0; } 8% { transform: translate(5px,-3px) rotate(-70deg) scale(1); opacity: 1; } 55% { transform: translate(27px,-22px) rotate(-215deg) scale(0.95); opacity: 1; } 80% { transform: translate(30px,-12px) rotate(-305deg) scale(0.5); opacity: 0.3; } 100% { transform: translate(31px,-4px) rotate(-370deg) scale(0.1); opacity: 0; } }
          @keyframes ptrh-k5 { 0% { transform: translate(0,0) rotate(0deg) scale(0); opacity: 0; } 8% { transform: translate(-5px,-3px) rotate(110deg) scale(1); opacity: 1; } 55% { transform: translate(-29px,-18px) rotate(260deg) scale(0.95); opacity: 1; } 80% { transform: translate(-31px,-8px) rotate(350deg) scale(0.5); opacity: 0.3; } 100% { transform: translate(-32px,0) rotate(410deg) scale(0.1); opacity: 0; } }
          @keyframes ptrh-k6 { 0% { transform: translate(0,0) rotate(0deg) scale(0); opacity: 0; } 8% { transform: translate(1px,-8px) rotate(-90deg) scale(1); opacity: 1; } 55% { transform: translate(8px,-42px) rotate(-220deg) scale(0.95); opacity: 1; } 80% { transform: translate(9px,-30px) rotate(-315deg) scale(0.5); opacity: 0.3; } 100% { transform: translate(10px,-22px) rotate(-380deg) scale(0.1); opacity: 0; } }
          .ptrh-k1 { animation: ptrh-k1 1.85s ease-in-out infinite;        transform-box: fill-box; transform-origin: center; }
          .ptrh-k2 { animation: ptrh-k2 1.70s ease-in-out infinite 0.28s; transform-box: fill-box; transform-origin: center; }
          .ptrh-k3 { animation: ptrh-k3 1.60s ease-in-out infinite 0.55s; transform-box: fill-box; transform-origin: center; }
          .ptrh-k4 { animation: ptrh-k4 1.80s ease-in-out infinite 0.82s; transform-box: fill-box; transform-origin: center; }
          .ptrh-k5 { animation: ptrh-k5 1.95s ease-in-out infinite 1.10s; transform-box: fill-box; transform-origin: center; }
          .ptrh-k6 { animation: ptrh-k6 1.55s ease-in-out infinite 0.15s; transform-box: fill-box; transform-origin: center; }
        `}</style>
      )}
      <ellipse className={active ? "ptrh-halo" : ""} cx="50" cy="58" rx="44" ry="34" fill="url(#ptrh-halo-grad)" filter="url(#ptrh-halo-blur)" opacity={active ? undefined : 0.55} />
      <ellipse className={active ? "ptrh-heat" : ""} cx="50" cy="61" rx="19" ry="10" fill="#fff1cd" opacity={active ? undefined : 0.14} />
      <g className={active ? "ptrh-bucket" : ""}>
        <rect x="28" y="58" width="44" height="7" rx="2.5" fill="#fff1cd" />
        <path d="M30 65 L35 94 L65 94 L70 65 Z" fill="transparent" stroke="#fff1cd" strokeWidth="1.9" strokeLinejoin="round" />
      </g>
      {active && (
        <>
          <g className="ptrh-k1"><circle cx="50" cy="60" r="3.4" fill="#fff1cd" /><circle cx="47" cy="58" r="2.4" fill="#fff1cd" /><circle cx="53" cy="58" r="2.1" fill="#fff1cd" /></g>
          <g className="ptrh-k2"><circle cx="50" cy="60" r="3.0" fill="#fff1cd" /><circle cx="48" cy="57.5" r="2.0" fill="#fff1cd" /><circle cx="53" cy="58.5" r="2.2" fill="#fff1cd" /></g>
          <g className="ptrh-k3"><circle cx="50" cy="60" r="3.1" fill="#fff1cd" /><circle cx="47.5" cy="58" r="2.3" fill="#fff1cd" /><circle cx="52.5" cy="57.5" r="2.0" fill="#fff1cd" /></g>
          <g className="ptrh-k4"><circle cx="50" cy="60" r="2.8" fill="#fff1cd" /><circle cx="52.5" cy="58.5" r="2.0" fill="#fff1cd" /><circle cx="48" cy="58" r="1.8" fill="#fff1cd" /></g>
          <g className="ptrh-k5"><circle cx="50" cy="60" r="3.0" fill="#fff1cd" /><circle cx="47" cy="58.5" r="2.2" fill="#fff1cd" /><circle cx="52.5" cy="57.5" r="1.8" fill="#fff1cd" /></g>
          <g className="ptrh-k6"><circle cx="50" cy="60" r="2.6" fill="#fff1cd" /><circle cx="48" cy="57.5" r="2.0" fill="#fff1cd" /><circle cx="52.5" cy="58.5" r="1.8" fill="#fff1cd" /></g>
        </>
      )}
      <g className={active ? "ptrh-pa" : ""}>
        <circle cx="36" cy="51" r="5.5" fill="#fff1cd" />
        <circle cx="30" cy="47" r="4"   fill="#fff1cd" />
        <circle cx="36" cy="43" r="4.5" fill="#fff1cd" />
        <circle cx="42" cy="47" r="4"   fill="#fff1cd" />
      </g>
      <g className={active ? "ptrh-pb" : ""}>
        <circle cx="50" cy="47" r="6.5" fill="#fff1cd" />
        <circle cx="43" cy="42" r="4.5" fill="#fff1cd" />
        <circle cx="50" cy="37" r="5.5" fill="#fff1cd" />
        <circle cx="57" cy="42" r="4.5" fill="#fff1cd" />
        <circle cx="44" cy="50" r="3.5" fill="#fff1cd" />
        <circle cx="56" cy="50" r="3.5" fill="#fff1cd" />
      </g>
      <g className={active ? "ptrh-pc" : ""}>
        <circle cx="64" cy="51" r="5.5" fill="#fff1cd" />
        <circle cx="58" cy="47" r="4"   fill="#fff1cd" />
        <circle cx="64" cy="43" r="4.5" fill="#fff1cd" />
        <circle cx="70" cy="47" r="4"   fill="#fff1cd" />
      </g>
    </svg>
  );
}

// ── Saved tab overlay ───────────────────────────────────────────────────
export function SavedScreen({
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
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-2" style={{ background: "rgba(255,241,205,0.12)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,241,205,0.22)", boxShadow: "0 8px 32px rgba(0,0,0,0.08)" }}>
            <Bookmark className="w-8 h-8" style={{ color: "#fff1cd", strokeWidth: 1.6 }} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "18px", lineHeight: 1.1, color: "#fff1cd", letterSpacing: "0.02em" }}>Nothing saved yet</h1>
            <p className="font-['Manrope'] leading-relaxed" style={{ fontSize: "14px", color: "rgba(255,241,205,0.48)" }}>Bookmark articles as you scroll to build your reading list.</p>
          </div>
          <button onClick={onBrowse} className="mt-3 px-8 py-3 rounded-full font-['Inter'] font-semibold text-sm tracking-wide transition-opacity hover:opacity-85" style={{ background: "#fff1cd", color: "#053980" }}>Browse</button>
        </div>
      </div>
    );
  }
  return (
    <div className="pn-fullscreen fixed inset-0 overflow-hidden flex flex-col items-center" style={{ background: "#053980", zIndex: 1 }}>
      <GrainBackground />
      <div className="relative z-10 flex flex-col h-full w-full" style={{ maxWidth: '480px' }}>
        <div className="px-5 pb-4" style={{ paddingTop: 'calc(72px + env(safe-area-inset-top))' }}>
          <h2 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "19px", color: "#fff1cd", letterSpacing: "0.02em", lineHeight: 1 }}>Saved</h2>
          <p className="font-['Inter'] mt-0.5" style={{ fontSize: "13px", color: "rgba(255,241,205,0.6)" }}>{articles.length} {articles.length === 1 ? "article" : "articles"}</p>
          <div style={{ marginTop: "12px", height: "1px", background: "rgba(255,241,205,0.10)" }} />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-24 scrollbar-hide flex flex-col gap-3">
          {articles.map((article, i) => (
            <button key={article.id} onClick={() => onReadMore(article)} className="w-full text-left rounded-2xl overflow-hidden flex gap-0 active:opacity-70" style={{ background: "rgba(255,241,205,0.07)", border: "1px solid rgba(255,241,205,0.08)", boxShadow: "0 2px 16px rgba(0,0,0,0.10)", opacity: 0, animation: "saved-card-in 0.38s ease forwards", animationDelay: `${i * 0.06}s` }}>
              {article.imageUrl && (
                <div className="w-28 self-stretch flex-shrink-0 relative overflow-hidden">
                  <img src={article.imageUrl} alt={article.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
                </div>
              )}
              <div className="flex-1 p-3.5 flex flex-col justify-between min-w-0 gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="flex items-center gap-1" style={{ background: 'rgba(255,241,205,0.10)', border: '1px solid rgba(255,241,205,0.16)', borderRadius: 999, paddingLeft: 5, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
                    <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: CATEGORY_COLORS[article.category] ?? 'rgba(255,241,205,0.4)', boxShadow: `0 0 4px 1px ${CATEGORY_COLORS[article.category] ?? 'rgba(255,241,205,0.3)'}` }} />
                    <span style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "8px", color: "rgba(255,241,205,0.85)", letterSpacing: "0.10em", textTransform: "uppercase" }}>{article.category}</span>
                  </span>
                  <span style={{ background: 'rgba(255,241,205,0.07)', border: '1px solid rgba(255,241,205,0.12)', borderRadius: 999, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "8px", color: "rgba(255,241,205,0.50)", letterSpacing: "0.08em" }}>{article.source}</span>
                </div>
                <p className="font-['Manrope'] font-bold leading-snug line-clamp-2" style={{ fontSize: "14px", color: "#fff1cd" }}>{article.title}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LegalRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-3.5 transition-colors active:bg-white/5" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: "14px", color: "#fff1cd", background: "transparent" }}>
      <span>{label}</span>
      <ChevronRight className="w-4 h-4" style={{ color: "rgba(255,241,205,0.38)" }} strokeWidth={2} />
    </button>
  );
}

// ── Profile tab overlay ─────────────────────────────────────────────────
export function ProfileScreen({
  onSignIn,
  onCreateAccount,
  onSignOut,
  onOpenLegal,
  onOpenNotifications,
  onOpenSettings,
  unreadCount,
  userName,
  userHandle,
  userAvatar,
  topics,
}: {
  onSignIn: () => void;
  onCreateAccount: () => void;
  onSignOut: () => void;
  onOpenLegal: (kind: LegalKind) => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  unreadCount: number;
  userName: string | null;
  userHandle: string | null;
  userAvatar: string | null;
  topics: string[];
}) {
  const isLoggedIn = !!userName || !!userHandle;
  const initial = (userName ?? userHandle ?? "?")[0].toUpperCase();
  return (
    <div className="pn-fullscreen fixed inset-0 flex flex-col items-center overflow-hidden" style={{ background: "#053980", zIndex: 1 }}>
      <GrainBackground />
      {isLoggedIn ? (
        <div className="relative z-10 flex flex-col h-full overflow-y-auto scrollbar-hide pb-28 mx-auto w-full" style={{ paddingTop: 'calc(72px + env(safe-area-inset-top))', maxWidth: '480px' }}>
          <div className="px-5 flex items-center gap-4 mb-6">
            <button
              onClick={onOpenSettings}
              aria-label="Open settings"
              className="transition-all active:scale-95 hover:opacity-90"
              style={{ width: 60, height: 60, borderRadius: "50%", flexShrink: 0, background: "rgba(255,241,205,0.09)", border: "1.5px solid rgba(255,241,205,0.22)", boxShadow: "0 0 0 5px rgba(255,241,205,0.05)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: 0 }}
            >
              {userAvatar ? (
                <img src={userAvatar} alt={userName ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "24px", color: "#fff1cd", lineHeight: 1 }}>{initial}</span>
              )}
            </button>
            <div className="flex flex-col min-w-0 flex-1">
              {userName && (
                <h1 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "20px", color: "#fff1cd", letterSpacing: "0.02em", lineHeight: 1.1, margin: 0 }} className="truncate">{userName}</h1>
              )}
              {userHandle && (
                <p className="font-['Inter'] truncate" style={{ fontSize: "13px", color: "rgba(255,241,205,0.55)", marginTop: 2, lineHeight: 1.1 }}>{userHandle}</p>
              )}
            </div>
            <button onClick={onOpenNotifications} className="transition-opacity active:opacity-60 hover:opacity-80" style={{ flexShrink: 0, lineHeight: 0, padding: 2, marginLeft: "auto" }} aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}>
              <PopcornIcon size={64} hasDot={unreadCount > 0} />
            </button>
          </div>
          {topics.length > 0 && (
            <div className="px-5 mb-6">
              <div style={{ height: "1px", background: "rgba(255,241,205,0.08)", marginBottom: 16 }} />
              <p style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "10px", color: "rgba(255,241,205,0.38)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Your Topics</p>
              <div className="flex flex-wrap gap-2">
                {topics.map(t => (
                  <span key={t} className="px-3 py-1.5 font-['Inter'] font-medium" style={{ fontSize: "12px", background: "rgba(255,241,205,0.08)", color: "#fff1cd", borderRadius: 20, border: "1px solid rgba(255,241,205,0.12)" }}>{t}</span>
                ))}
              </div>
            </div>
          )}
          <div className="px-5 mb-6">
            <div style={{ height: "1px", background: "rgba(255,241,205,0.08)", marginBottom: 16 }} />
            <button onClick={() => onOpenLegal("about")} className="flex items-center gap-2 transition-opacity active:opacity-60 hover:opacity-80" style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "12px", color: "#fff1cd", letterSpacing: "0.10em", textTransform: "uppercase", background: "rgba(255,241,205,0.08)", border: "1px solid rgba(255,241,205,0.16)", borderRadius: 999, paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8 }}>
              About Popcorn
              <ChevronRight className="w-3.5 h-3.5" style={{ color: "rgba(255,241,205,0.50)" }} strokeWidth={2} />
            </button>
          </div>
          <div className="px-5 mb-6">
            <div style={{ height: "1px", background: "rgba(255,241,205,0.08)", marginBottom: 16 }} />
            <p style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "12px", color: "#fff1cd", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Legal</p>
            <div style={{ borderRadius: 16, background: "rgba(255,241,205,0.05)", border: "1px solid rgba(255,241,205,0.10)", overflow: "hidden" }}>
              <LegalRow label="Privacy Policy" onClick={() => onOpenLegal("privacy")} />
              <div style={{ height: 1, background: "rgba(255,241,205,0.08)" }} />
              <LegalRow label="Terms & Conditions" onClick={() => onOpenLegal("terms")} />
              <div style={{ height: 1, background: "rgba(255,241,205,0.08)" }} />
              <LegalRow label="Contact us" onClick={() => { window.location.href = "mailto:hello@popcornmedia.org"; }} />
            </div>
          </div>
          <div className="px-5 mb-6">
            <p className="font-['Inter']" style={{ fontSize: "11px", color: "rgba(255,241,205,0.32)", letterSpacing: "0.04em" }}>Version {APP_VERSION}</p>
          </div>
          <div className="mt-auto px-5">
            <div style={{ height: "1px", background: "rgba(255,241,205,0.08)", marginBottom: 16 }} />
            <button onClick={onSignOut} className="flex items-center gap-2 font-['Inter'] transition-opacity hover:opacity-60 active:opacity-50" style={{ fontSize: "12px", color: "rgba(255,241,205,0.38)", letterSpacing: "0.02em" }}>
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-8 text-center">
          <div style={{ width: 80, height: 80, borderRadius: "50%", marginBottom: 24, background: "rgba(255,241,205,0.12)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,241,205,0.22)", boxShadow: "0 8px 32px rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <User className="w-8 h-8" style={{ color: "#fff1cd", strokeWidth: 1.5 }} />
          </div>
          <h1 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "18px", lineHeight: 1, color: "#fff1cd", letterSpacing: "0.02em", marginBottom: 10 }}>Your Profile</h1>
          <p className="font-['Manrope'] leading-relaxed" style={{ fontSize: "14px", color: "rgba(255,241,205,0.48)", maxWidth: 260, marginBottom: 28 }}>Sign in to personalise your feed and keep your reading history in sync.</p>
          <div className="flex flex-col gap-3 w-full" style={{ maxWidth: 280 }}>
            <button onClick={onSignIn} className="w-full py-3.5 rounded-full font-['Inter'] font-semibold text-sm tracking-wide transition-opacity hover:opacity-85" style={{ background: "#fff1cd", color: "#053980" }}>Sign in</button>
            <button onClick={onCreateAccount} className="w-full py-3.5 rounded-full font-['Inter'] font-semibold text-sm tracking-wide transition-opacity hover:opacity-85" style={{ background: "rgba(255,241,205,0.09)", color: "#fff1cd", border: "1px solid rgba(255,241,205,0.14)" }}>Create account</button>
          </div>
        </div>
      )}
    </div>
  );
}
