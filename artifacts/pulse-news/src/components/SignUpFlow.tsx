import { useState } from "react";
import { X, ArrowRight, Check } from "lucide-react";

const TOPICS = [
  "AI & Machine Learning", "Climate", "Markets", "Geopolitics",
  "Health & Science", "Tech", "Space", "Energy", "Startups", "Crypto",
];

interface SignUpFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (name: string) => void;
}

export function SignUpFlow({ isOpen, onClose, onComplete }: SignUpFlowProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topics, setTopics] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
    setTimeout(() => { setStep(0); setDone(false); setName(""); setEmail(""); setTopics(new Set()); }, 400);
  };

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (step < 2) { setStep(s => s + 1); return; }
    setDone(true);
    setTimeout(() => {
      onComplete(name.trim() || "Reader");
      setTimeout(() => { setStep(0); setDone(false); }, 300);
    }, 1600);
  };

  const toggleTopic = (e: React.MouseEvent, t: string) => {
    e.stopPropagation();
    setTopics(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });
  };

  const canNext = step === 0
    ? name.trim().length > 0 && email.includes("@")
    : step === 1
    ? topics.size >= 1
    : true;

  const GreenAtmo = () => (
    <div className="absolute inset-0 rounded-[20px_20px_0_0] overflow-hidden pointer-events-none">
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          radial-gradient(circle at 12% 20%, rgba(26,68,48,0.22) 0%, transparent 52%),
          radial-gradient(circle at 88% 75%, rgba(44,82,62,0.18) 0%, transparent 52%)
        `,
        filter: 'blur(44px)',
      }} />
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 transition-opacity duration-300"
        style={{ background: 'rgba(0,0,0,0.45)', opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none' }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
        style={{
          height: '90dvh',
          background: 'rgba(236,243,239,0.97)',
          backdropFilter: 'blur(48px)',
          WebkitBackdropFilter: 'blur(48px)',
          borderRadius: '20px 20px 0 0',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.36s cubic-bezier(0.32,0.72,0,1)',
        }}
        onClick={stopProp}
      >
        <GreenAtmo />

        {/* Handle */}
        <div className="relative z-10 flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(0,0,0,0.15)' }} />
        </div>

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 z-20 p-1.5 rounded-full transition-opacity hover:opacity-60"
          style={{ background: 'rgba(0,0,0,0.07)' }}
        >
          <X className="w-4 h-4" style={{ color: 'rgba(0,0,0,0.45)' }} />
        </button>

        {/* Progress dots */}
        {!done && (
          <div className="relative z-10 flex items-center justify-center gap-2 pt-4 pb-1 flex-shrink-0">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === step ? '20px' : '6px',
                  height: '6px',
                  background: i === step ? '#000' : 'rgba(0,0,0,0.18)',
                }}
              />
            ))}
          </div>
        )}

        {/* Content area */}
        <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
          {done ? (
            /* ── Done ── */
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: '#000', animation: 'check-pop 0.5s cubic-bezier(0.22,1,0.36,1) both' }}
              >
                <Check className="w-9 h-9 text-white" strokeWidth={2.5} />
              </div>
              <div style={{ animation: 'tagline-reveal 0.5s ease 0.35s both' }}>
                <h2 className="font-['Manrope'] font-bold mb-2" style={{ fontSize: '28px', color: '#000' }}>
                  You're all set, {name.trim() || "Reader"}.
                </h2>
                <p className="font-['Neue_Montreal']" style={{ fontSize: '15px', color: 'rgba(0,0,0,0.45)' }}>
                  Your personalised feed is ready.
                </p>
              </div>
            </div>
          ) : step === 0 ? (
            /* ── Step 0: Details ── */
            <div className="flex-1 flex flex-col px-7 pt-8 pb-6 gap-7" style={{ animation: 'step-in 0.35s ease both' }}>
              <div>
                <h2 className="font-['Manrope'] font-bold mb-1.5" style={{ fontSize: '30px', color: '#000', lineHeight: 1.1 }}>
                  Create your account.
                </h2>
                <p className="font-['Neue_Montreal']" style={{ fontSize: '15px', color: 'rgba(0,0,0,0.45)' }}>
                  Start reading smarter in under a minute.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-['Neue_Montreal'] font-semibold" style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Name</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onClick={stopProp}
                    placeholder="Your name"
                    className="w-full rounded-xl px-4 py-3.5 font-['Neue_Montreal'] outline-none transition-shadow"
                    style={{ background: 'rgba(0,0,0,0.06)', fontSize: '16px', color: '#000', border: '1px solid rgba(0,0,0,0.08)' }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-['Neue_Montreal'] font-semibold" style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onClick={stopProp}
                    placeholder="you@example.com"
                    className="w-full rounded-xl px-4 py-3.5 font-['Neue_Montreal'] outline-none"
                    style={{ background: 'rgba(0,0,0,0.06)', fontSize: '16px', color: '#000', border: '1px solid rgba(0,0,0,0.08)' }}
                  />
                </div>

                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.10)' }} />
                  <span className="font-['Neue_Montreal']" style={{ fontSize: '12px', color: 'rgba(0,0,0,0.30)' }}>or</span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.10)' }} />
                </div>

                <button
                  onClick={stopProp}
                  className="w-full flex items-center justify-center gap-3 rounded-xl py-3.5 font-['Neue_Montreal'] font-semibold transition-opacity hover:opacity-80"
                  style={{ background: 'rgba(0,0,0,0.06)', fontSize: '15px', color: '#000', border: '1px solid rgba(0,0,0,0.08)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>
              </div>
            </div>
          ) : step === 1 ? (
            /* ── Step 1: Topics ── */
            <div className="flex-1 flex flex-col px-7 pt-8 pb-6" style={{ animation: 'step-in 0.35s ease both' }}>
              <h2 className="font-['Manrope'] font-bold mb-1.5" style={{ fontSize: '28px', color: '#000', lineHeight: 1.1 }}>
                What interests you?
              </h2>
              <p className="font-['Neue_Montreal'] mb-7" style={{ fontSize: '15px', color: 'rgba(0,0,0,0.45)' }}>
                Pick at least one topic to shape your feed.
              </p>

              <div className="flex flex-wrap gap-2.5">
                {TOPICS.map(t => {
                  const sel = topics.has(t);
                  return (
                    <button
                      key={t}
                      onClick={(e) => toggleTopic(e, t)}
                      className="px-4 py-2.5 rounded-full font-['Neue_Montreal'] font-medium transition-all duration-150"
                      style={{
                        fontSize: '13px',
                        background: sel ? '#000' : 'rgba(0,0,0,0.07)',
                        color: sel ? '#fff' : 'rgba(0,0,0,0.65)',
                        border: sel ? '1px solid #000' : '1px solid rgba(0,0,0,0.10)',
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── Step 2: Notifications ── */
            <div className="flex-1 flex flex-col px-7 pt-8 pb-6 gap-6" style={{ animation: 'step-in 0.35s ease both' }}>
              <div>
                <h2 className="font-['Manrope'] font-bold mb-1.5" style={{ fontSize: '28px', color: '#000', lineHeight: 1.1 }}>
                  Stay in the loop.
                </h2>
                <p className="font-['Neue_Montreal']" style={{ fontSize: '15px', color: 'rgba(0,0,0,0.45)' }}>
                  Choose how Bref. reaches you.
                </p>
              </div>

              {[
                { label: "Breaking news alerts", sub: "The stories that matter, instantly." },
                { label: "Morning briefing", sub: "A digest of the day's top stories at 8am." },
                { label: "Weekly digest", sub: "The week's best reads, every Sunday." },
              ].map(({ label, sub }) => (
                <NotifToggle key={label} label={label} sub={sub} />
              ))}
            </div>
          )}
        </div>

        {/* CTA button */}
        {!done && (
          <div className="relative z-10 px-7 pb-10 pt-4 flex-shrink-0">
            <button
              onClick={next}
              disabled={!canNext}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-['Manrope'] font-bold transition-all duration-150"
              style={{
                fontSize: '16px',
                background: canNext ? '#000' : 'rgba(0,0,0,0.12)',
                color: canNext ? '#fff' : 'rgba(0,0,0,0.30)',
              }}
            >
              {step === 2 ? "Finish" : "Continue"}
              <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function NotifToggle({ label, sub }: { label: string; sub: string }) {
  const [on, setOn] = useState(false);
  return (
    <div
      className="flex items-center justify-between gap-4 p-4 rounded-2xl cursor-pointer"
      style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.07)' }}
      onClick={(e) => { e.stopPropagation(); setOn(v => !v); }}
    >
      <div>
        <p className="font-['Neue_Montreal'] font-semibold" style={{ fontSize: '14px', color: '#000' }}>{label}</p>
        <p className="font-['Neue_Montreal']" style={{ fontSize: '12px', color: 'rgba(0,0,0,0.40)' }}>{sub}</p>
      </div>
      <div
        className="flex-shrink-0 w-12 h-7 rounded-full relative transition-colors duration-200"
        style={{ background: on ? '#000' : 'rgba(0,0,0,0.16)' }}
      >
        <div
          className="absolute top-1 w-5 h-5 rounded-full bg-white transition-transform duration-200"
          style={{ transform: on ? 'translateX(24px)' : 'translateX(4px)', boxShadow: '0 1px 4px rgba(0,0,0,0.22)' }}
        />
      </div>
    </div>
  );
}
