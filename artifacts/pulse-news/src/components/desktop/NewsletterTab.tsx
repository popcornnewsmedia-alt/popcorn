import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, X, Check, ArrowRight } from "lucide-react";
import { apiBase } from "@/lib/api-base";

/* ── Brand tokens (mirrors DesktopHome) ─────────────────────────────────── */
const BLUE = "#042c85";
const BLUE_DEEP = "#03205f";
const CREAM = "#fff1cd";
const PAPER = "#fbf7ec";
const INK = "#14110a";
const MACABRO = "'Macabro', 'Anton', sans-serif";
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const SERIF = '"Bodoni Moda", "Didot", "Times New Roman", serif';

const DISMISS_KEY = "popcorn-newsletter-tab-dismissed";
const DONE_KEY = "popcorn-newsletter-subscribed";

type Status = "idle" | "loading" | "done" | "error";

/**
 * A discreet signature-blue tab pinned to the right edge of the desktop site.
 * Click → it slides open into a cream card that collects an email for the
 * daily newsletter. Distinct from the footer form; this is the ambient,
 * always-reachable layer. Remembers dismissal + prior signup in localStorage
 * so it never nags a reader who already opted in or closed it.
 */
export function NewsletterTab() {
  const [open, setOpen] = useState(false);
  // `hidden` = user dismissed the tab entirely, or already subscribed.
  const [hidden, setHidden] = useState(true);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const trapRef = useRef<HTMLInputElement>(null);

  // Decide visibility on mount (client-only — avoids SSR localStorage access).
  useEffect(() => {
    try {
      if (localStorage.getItem(DONE_KEY) || localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* private mode — just show it */
    }
    // Gentle entrance: let the page settle, then reveal the tab.
    const t = setTimeout(() => setHidden(false), 1400);
    return () => clearTimeout(t);
  }, []);

  // Close on Escape when the panel is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setError("");
    setStatus("loading");
    try {
      const res = await fetch(`${apiBase()}/api/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: "website-tab",
          company: trapRef.current?.value ?? "", // honeypot
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setError(data?.error || "Couldn't sign you up — please try again.");
        return;
      }
      setStatus("done");
      try {
        localStorage.setItem(DONE_KEY, "1");
      } catch {
        /* ignore */
      }
    } catch {
      setStatus("error");
      setError("Network error — please try again.");
    }
  }

  function dismiss() {
    setOpen(false);
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (hidden) return null;

  return (
    <>
      <style>{NEWSLETTER_TAB_CSS}</style>
      <div className="pc-nl-root" aria-live="polite">
        {/* ── Collapsed tab ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {!open && (
            <motion.button
              key="tab"
              type="button"
              className="pc-nl-tab"
              onClick={() => setOpen(true)}
              aria-label="Open newsletter signup"
              initial={{ x: 64, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 64, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              whileHover={{ x: -4 }}
            >
              <span className="pc-nl-tab-grain" aria-hidden />
              <Mail size={15} strokeWidth={2} className="pc-nl-tab-icon" />
              <span className="pc-nl-tab-label">The Daily Pop</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Expanded card ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {open && (
            <motion.div
              key="card"
              className="pc-nl-card"
              role="dialog"
              aria-label="Join the Popcorn newsletter"
              initial={{ x: 40, opacity: 0, scale: 0.96 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 40, opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              <span className="pc-nl-card-grain" aria-hidden />

              <button
                type="button"
                className="pc-nl-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={16} strokeWidth={2.2} />
              </button>

              {/* Blue header band */}
              <div className="pc-nl-head">
                <span className="pc-nl-head-grain" aria-hidden />
                <span className="pc-nl-kicker">Popcorn Newsletter</span>
                <h3 className="pc-nl-title">
                  Today's pop,
                  <br />
                  before coffee.
                </h3>
              </div>

              {/* Body */}
              <div className="pc-nl-body">
                {status === "done" ? (
                  <motion.div
                    className="pc-nl-success"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <span className="pc-nl-check">
                      <Check size={22} strokeWidth={2.6} />
                    </span>
                    <p className="pc-nl-success-h">You're in.</p>
                    <p className="pc-nl-success-p">
                      One handpicked email, every morning. Watch your inbox.
                    </p>
                    <button type="button" className="pc-nl-ghost" onClick={dismiss}>
                      Done
                    </button>
                  </motion.div>
                ) : (
                  <>
                    <p className="pc-nl-pitch">
                      A short, daily dispatch of the culture stories worth knowing —
                      surprising, fascinating, the things people are talking about.
                    </p>
                    <form className="pc-nl-form" onSubmit={submit} noValidate>
                      {/* Honeypot — visually hidden, off-screen, not for humans. */}
                      <input
                        ref={trapRef}
                        type="text"
                        name="company"
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden
                        className="pc-nl-trap"
                      />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (status === "error") setStatus("idle");
                        }}
                        placeholder="you@email.com"
                        className="pc-nl-input"
                        aria-label="Email address"
                        autoComplete="email"
                      />
                      <button
                        type="submit"
                        className="pc-nl-submit"
                        disabled={status === "loading"}
                      >
                        {status === "loading" ? (
                          <span className="pc-nl-spin" aria-label="Submitting" />
                        ) : (
                          <>
                            Join <ArrowRight size={15} strokeWidth={2.4} />
                          </>
                        )}
                      </button>
                    </form>
                    {status === "error" && <p className="pc-nl-err">{error}</p>}
                    <p className="pc-nl-fine">
                      No spam. Unsubscribe anytime.
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

/* ── Scoped styles ──────────────────────────────────────────────────────── */
const NEWSLETTER_TAB_CSS = `
.pc-nl-root{
  position:fixed; right:0; top:50%; transform:translateY(-50%);
  z-index:1200; font-family:${SANS};
}

/* Collapsed vertical tab */
.pc-nl-tab{
  position:relative; right:0;
  display:flex; flex-direction:column; align-items:center; gap:9px;
  padding:16px 9px 18px; border:0; cursor:pointer;
  background:${BLUE};
  color:${CREAM};
  border-radius:12px 0 0 12px;
  box-shadow:-6px 8px 26px rgba(4,44,133,0.30), inset 0 0 0 1px rgba(255,241,205,0.14);
  overflow:hidden;
  -webkit-tap-highlight-color:transparent;
}
.pc-nl-tab-grain, .pc-nl-card-grain, .pc-nl-head-grain{
  position:absolute; inset:0; pointer-events:none; opacity:0.5;
  background-image:url('https://popcornmedia.org/email-grain-blue.png');
  background-size:auto; background-repeat:repeat; mix-blend-mode:overlay;
}
.pc-nl-tab-icon{ position:relative; z-index:1; }
.pc-nl-tab-label{
  position:relative; z-index:1;
  writing-mode:vertical-rl; text-orientation:mixed;
  font-family:${MACABRO}; font-size:13px; letter-spacing:0.18em;
  text-transform:uppercase; line-height:1;
}

/* Expanded card */
.pc-nl-card{
  position:relative; width:332px; max-width:calc(100vw - 24px);
  background:${PAPER}; color:${INK};
  border-radius:16px 0 0 16px;
  box-shadow:-14px 18px 48px rgba(4,44,133,0.26), inset 0 0 0 1px rgba(4,44,133,0.10);
  overflow:hidden;
}
.pc-nl-card-grain{
  opacity:0.06; mix-blend-mode:normal;
}
.pc-nl-close{
  position:absolute; top:11px; right:12px; z-index:3;
  width:30px; height:30px; display:grid; place-items:center;
  border:0; border-radius:999px; cursor:pointer;
  background:rgba(255,241,205,0.18); color:${CREAM};
  transition:background .2s ease;
}
.pc-nl-close:hover{ background:rgba(255,241,205,0.32); }

.pc-nl-head{
  position:relative; background:${BLUE};
  padding:26px 24px 22px; overflow:hidden;
}
.pc-nl-kicker{
  position:relative; z-index:1;
  display:inline-block; font-size:10px; letter-spacing:0.22em;
  text-transform:uppercase; font-weight:600;
  color:rgba(255,241,205,0.72); margin-bottom:10px;
}
.pc-nl-title{
  position:relative; z-index:1; margin:0;
  font-family:${SERIF}; font-style:italic; font-weight:600;
  font-size:27px; line-height:1.04; color:${CREAM};
  letter-spacing:0.01em;
}

.pc-nl-body{ padding:20px 24px 22px; }
.pc-nl-pitch{
  margin:0 0 16px; font-size:13.5px; line-height:1.58;
  color:rgba(20,17,10,0.74);
}
.pc-nl-form{ display:flex; gap:8px; }
.pc-nl-trap{ position:absolute; left:-9999px; width:1px; height:1px; opacity:0; }
.pc-nl-input{
  flex:1; min-width:0; background:#fff;
  border:1px solid rgba(4,44,133,0.22); border-radius:10px;
  padding:11px 13px; font-size:13.5px; font-family:${SANS}; color:${INK};
  outline:none; transition:border-color .2s ease, box-shadow .2s ease;
}
.pc-nl-input::placeholder{ color:rgba(20,17,10,0.38); }
.pc-nl-input:focus{
  border-color:${BLUE}; box-shadow:0 0 0 3px rgba(4,44,133,0.12);
}
.pc-nl-submit{
  display:inline-flex; align-items:center; gap:6px;
  background:${BLUE}; color:${CREAM}; border:0; border-radius:10px;
  padding:0 16px; font-size:12px; font-weight:700; letter-spacing:0.06em;
  text-transform:uppercase; cursor:pointer; white-space:nowrap;
  transition:background .2s ease, transform .12s ease;
}
.pc-nl-submit:hover:not(:disabled){ background:${BLUE_DEEP}; }
.pc-nl-submit:active:not(:disabled){ transform:translateY(1px); }
.pc-nl-submit:disabled{ opacity:0.7; cursor:default; }
.pc-nl-spin{
  width:15px; height:15px; border-radius:999px; display:inline-block;
  border:2px solid rgba(255,241,205,0.4); border-top-color:${CREAM};
  animation:pc-nl-spin 0.7s linear infinite;
}
@keyframes pc-nl-spin{ to{ transform:rotate(360deg); } }

.pc-nl-err{ margin:9px 0 0; font-size:12px; color:#b3261e; line-height:1.4; }
.pc-nl-fine{
  margin:12px 0 0; font-size:11px; letter-spacing:0.02em;
  color:rgba(20,17,10,0.42);
}

/* Success state */
.pc-nl-success{ text-align:center; padding:6px 0 2px; }
.pc-nl-check{
  display:inline-grid; place-items:center; width:46px; height:46px;
  border-radius:999px; background:${BLUE}; color:${CREAM}; margin-bottom:12px;
}
.pc-nl-success-h{
  margin:0 0 6px; font-family:${SERIF}; font-style:italic; font-weight:600;
  font-size:22px; color:${BLUE};
}
.pc-nl-success-p{
  margin:0 0 16px; font-size:13px; line-height:1.55; color:rgba(20,17,10,0.7);
}
.pc-nl-ghost{
  background:transparent; border:1px solid rgba(4,44,133,0.3); color:${BLUE};
  border-radius:999px; padding:8px 22px; font-size:11px; font-weight:700;
  letter-spacing:0.12em; text-transform:uppercase; cursor:pointer;
  transition:background .2s ease;
}
.pc-nl-ghost:hover{ background:rgba(4,44,133,0.07); }

/* On small viewports the tab can collide with content — keep it but slimmer */
@media (max-width:560px){
  .pc-nl-tab-label{ font-size:11px; letter-spacing:0.14em; }
}
@media (prefers-reduced-motion:reduce){
  .pc-nl-spin{ animation-duration:1.4s; }
}
`;
