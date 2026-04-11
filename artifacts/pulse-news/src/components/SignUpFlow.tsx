import { useState } from "react";
import { X, ArrowRight, Check, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { GrainBackground } from "@/components/GrainBackground";
import type { LegalKind } from "@/components/LegalSheet";

const TOPICS = [
  "AI & Machine Learning", "Climate", "Markets", "Geopolitics",
  "Health & Science", "Tech", "Space", "Energy", "Startups", "Crypto",
];

interface SignUpFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (name: string) => void;
  onOpenLegal?: (kind: LegalKind) => void;
}

export function SignUpFlow({ isOpen, onClose, onComplete, onOpenLegal }: SignUpFlowProps) {
  const { signUp, signInWithGoogle, updateProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [topics, setTopics] = useState<Set<string>>(new Set());
  const [notifs, setNotifs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [done, setDone] = useState(false);

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  const reset = () => {
    setStep(0); setDone(false); setEmailSent(false);
    setName(""); setEmail(""); setPassword("");
    setTopics(new Set()); setNotifs(new Set());
    setError(null); setLoading(false);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
    setTimeout(reset, 400);
  };

  const handleNext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);

    if (step === 0) {
      setLoading(true);
      try {
        const data = await signUp(email, password, name);
        if (!data.session) {
          setEmailSent(true);
        } else {
          setStep(1);
        }
      } catch (err: any) {
        setError(err.message ?? "Sign up failed. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (step < 2) { setStep(s => s + 1); return; }

    setLoading(true);
    try {
      await updateProfile({ topics: [...topics], notifications: [...notifs] });
    } catch { /* Non-fatal */ } finally {
      setLoading(false);
    }

    setDone(true);
    setTimeout(() => { onComplete(name.trim() || "Reader"); setTimeout(reset, 300); }, 1600);
  };

  const handleGoogle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message ?? "Google sign in failed.");
    }
  };

  const toggleTopic = (e: React.MouseEvent, t: string) => {
    e.stopPropagation();
    setTopics(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });
  };

  const canNext =
    step === 0 ? name.trim().length > 0 && email.includes("@") && password.length >= 8
    : step === 1 ? topics.size >= 1
    : true;

  const stepLabels = ["Account", "Topics", "Alerts"];

  return (
    <>
      <div
        className="fixed inset-0 z-[220] transition-opacity duration-300"
        style={{ background: 'rgba(0,0,0,0.65)', opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none' }}
        onClick={handleClose}
      />

      <div
        className="fixed inset-x-0 bottom-0 z-[220] flex flex-col overflow-hidden"
        style={{
          height: '90dvh',
          background: '#053980',
          borderRadius: '20px 20px 0 0',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.36s cubic-bezier(0.32,0.72,0,1)',
        }}
        onClick={stopProp}
      >
        <GrainBackground />

        {/* Handle */}
        <div className="relative z-10 flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,241,205,0.30)' }} />
        </div>

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 z-20 p-2 rounded-full transition-opacity hover:opacity-60 active:opacity-50"
          style={{ background: 'rgba(255,241,205,0.10)' }}
        >
          <X className="w-4 h-4" style={{ color: 'rgba(255,241,205,0.65)' }} />
        </button>

        {/* Step progress */}
        {!done && !emailSent && (
          <div className="relative z-10 flex items-center justify-center gap-3 pt-3 pb-1 flex-shrink-0">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === step ? '22px' : '6px',
                  height: '6px',
                  background: i === step ? '#fff1cd' : i < step ? 'rgba(255,241,205,0.45)' : 'rgba(255,241,205,0.18)',
                }}
              />
            ))}
          </div>
        )}

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
          {done ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: '#fff1cd', animation: 'check-pop 0.5s cubic-bezier(0.22,1,0.36,1) both' }}
              >
                <Check className="w-9 h-9" style={{ color: '#053980' }} strokeWidth={2.5} />
              </div>
              <div style={{ animation: 'tagline-reveal 0.5s ease 0.35s both' }}>
                <h2 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '32px', color: '#fff1cd', lineHeight: 1.05, letterSpacing: '0.02em', marginBottom: '10px' }}>
                  YOU'RE ALL SET,<br />{(name.trim() || "READER").toUpperCase()}.
                </h2>
                <p className="font-['Inter']" style={{ fontSize: '14px', color: 'rgba(255,241,205,0.50)' }}>
                  Your personalised feed is ready.
                </p>
              </div>
            </div>

          ) : emailSent ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,241,205,0.10)', border: '1px solid rgba(255,241,205,0.18)' }}
              >
                <Mail className="w-9 h-9" style={{ color: '#fff1cd' }} strokeWidth={1.5} />
              </div>
              <div>
                <h2 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '22px', color: '#fff1cd', lineHeight: 1.1, letterSpacing: '0.02em', marginBottom: '10px' }}>
                  CHECK YOUR<br />INBOX.
                </h2>
                <p className="font-['Inter']" style={{ fontSize: '14px', color: 'rgba(255,241,205,0.50)', lineHeight: 1.6 }}>
                  We sent a confirmation link to{" "}
                  <span style={{ color: '#fff1cd', fontWeight: 600 }}>{email}</span>.
                  Click it to activate your account.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="mt-2 px-8 py-3.5 rounded-full transition-opacity hover:opacity-80 active:scale-[0.98]"
                style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '13px', letterSpacing: '0.08em', background: '#fff1cd', color: '#053980' }}
              >
                GOT IT
              </button>
            </div>

          ) : step === 0 ? (
            <div className="flex-1 flex flex-col px-6 pt-7 pb-5 gap-6 overflow-y-auto" style={{ animation: 'step-in 0.35s ease both' }}>
              <div>
                <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,241,205,0.38)', marginBottom: '8px' }}>
                  {stepLabels[0]} · 1 of 3
                </p>
                <h2 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '15px', color: '#fff1cd', lineHeight: 1, letterSpacing: '0.02em' }}>
                  CREATE YOUR ACCOUNT.
                </h2>
              </div>

              <div className="flex flex-col gap-3.5">
                {[
                  { label: "Name", type: "text", value: name, set: setName, placeholder: "Your name" },
                  { label: "Email", type: "email", value: email, set: setEmail, placeholder: "you@example.com" },
                  { label: "Password", type: "password", value: password, set: setPassword, placeholder: "Min. 8 characters" },
                ].map(({ label, type, value, set, placeholder }) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <label style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#fff1cd' }}>{label}</label>
                    <input
                      type={type}
                      value={value}
                      onChange={e => set(e.target.value)}
                      onClick={stopProp}
                      placeholder={placeholder}
                      className="w-full rounded-xl px-4 py-3.5 outline-none font-['Inter'] placeholder-[rgba(255,241,205,0.22)]"
                      style={{ background: 'rgba(255,241,205,0.07)', fontSize: '15px', color: '#fff1cd', border: '1px solid rgba(255,241,205,0.13)' }}
                    />
                  </div>
                ))}

                {error && (
                  <p className="font-['Inter']" style={{ fontSize: '13px', color: '#ff8a80' }}>{error}</p>
                )}

                <div className="flex items-center gap-3 my-0.5">
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,241,205,0.12)' }} />
                  <span className="font-['Inter']" style={{ fontSize: '11px', color: 'rgba(255,241,205,0.25)' }}>or</span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,241,205,0.12)' }} />
                </div>

                <button
                  onClick={handleGoogle}
                  className="w-full flex items-center justify-center gap-3 rounded-xl py-3.5 font-['Inter'] font-semibold transition-opacity hover:opacity-80 active:opacity-60"
                  style={{ background: 'rgba(255,241,205,0.07)', fontSize: '14px', color: '#fff1cd', border: '1px solid rgba(255,241,205,0.13)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
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
            <div className="flex-1 flex flex-col px-6 pt-7 pb-5 overflow-y-auto" style={{ animation: 'step-in 0.35s ease both' }}>
              <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,241,205,0.38)', marginBottom: '8px' }}>
                {stepLabels[1]} · 2 of 3
              </p>
              <h2 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '34px', color: '#fff1cd', lineHeight: 1, letterSpacing: '0.02em', marginBottom: '6px' }}>
                WHAT MOVES<br />YOU?
              </h2>
              <p className="font-['Inter'] mb-6" style={{ fontSize: '13px', color: 'rgba(255,241,205,0.45)' }}>
                Pick at least one topic to shape your feed.
              </p>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map(t => {
                  const sel = topics.has(t);
                  return (
                    <button
                      key={t}
                      onClick={(e) => toggleTopic(e, t)}
                      className="px-4 py-2.5 rounded-full transition-all duration-150 active:scale-95"
                      style={{
                        fontFamily: "'Macabro', 'Anton', sans-serif",
                        fontSize: '10px',
                        letterSpacing: '0.06em',
                        background: sel ? '#fff1cd' : 'rgba(255,241,205,0.07)',
                        color: sel ? '#053980' : 'rgba(255,241,205,0.65)',
                        border: sel ? '1px solid #fff1cd' : '1px solid rgba(255,241,205,0.18)',
                      }}
                    >
                      {t.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>

          ) : (
            <div className="flex-1 flex flex-col px-6 pt-7 pb-5 gap-5 overflow-y-auto" style={{ animation: 'step-in 0.35s ease both' }}>
              <div>
                <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,241,205,0.38)', marginBottom: '8px' }}>
                  {stepLabels[2]} · 3 of 3
                </p>
                <h2 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '34px', color: '#fff1cd', lineHeight: 1, letterSpacing: '0.02em' }}>
                  STAY IN<br />THE LOOP.
                </h2>
              </div>
              {[
                { key: "breaking", label: "Breaking news alerts", sub: "The stories that matter, instantly." },
                { key: "morning", label: "Morning briefing", sub: "A digest of the day's top stories at 8am." },
                { key: "weekly", label: "Weekly digest", sub: "The week's best reads, every Sunday." },
              ].map(({ key, label, sub }) => (
                <NotifToggle
                  key={key}
                  label={label}
                  sub={sub}
                  on={notifs.has(key)}
                  onToggle={() => setNotifs(prev => {
                    const n = new Set(prev);
                    n.has(key) ? n.delete(key) : n.add(key);
                    return n;
                  })}
                />
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        {!done && !emailSent && (
          <div className="relative z-10 px-6 pb-10 pt-4 flex-shrink-0">
            <button
              onClick={handleNext}
              disabled={!canNext || loading}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl transition-all duration-150 active:scale-[0.98]"
              style={{
                fontFamily: "'Macabro', 'Anton', sans-serif",
                fontSize: '14px',
                letterSpacing: '0.08em',
                background: canNext && !loading ? '#fff1cd' : 'rgba(255,241,205,0.12)',
                color: canNext && !loading ? '#053980' : 'rgba(255,241,205,0.28)',
              }}
            >
              {loading ? "WORKING…" : step === 2 ? "FINISH" : "CONTINUE"}
              {!loading && <ArrowRight className="w-4 h-4" strokeWidth={2.5} />}
            </button>
            {step === 0 && onOpenLegal && (
              <p
                className="font-['Inter']"
                style={{
                  marginTop: '12px',
                  textAlign: 'center',
                  fontSize: '10.5px',
                  lineHeight: 1.55,
                  color: 'rgba(255,241,205,0.42)',
                }}
              >
                By creating an account you agree to our{" "}
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenLegal("terms"); }}
                  className="inline"
                  style={{ color: '#fff1cd', borderBottom: '1px solid rgba(255,241,205,0.45)', fontWeight: 600 }}
                >
                  Terms
                </button>{" "}
                and{" "}
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenLegal("privacy"); }}
                  className="inline"
                  style={{ color: '#fff1cd', borderBottom: '1px solid rgba(255,241,205,0.45)', fontWeight: 600 }}
                >
                  Privacy Policy
                </button>.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function NotifToggle({ label, sub, on, onToggle }: { label: string; sub: string; on: boolean; onToggle: () => void }) {
  return (
    <div
      className="flex items-center justify-between gap-4 p-4 rounded-2xl cursor-pointer transition-all active:opacity-70"
      style={{ background: 'rgba(255,241,205,0.06)', border: `1px solid ${on ? 'rgba(255,241,205,0.28)' : 'rgba(255,241,205,0.10)'}` }}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
    >
      <div>
        <p style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '11px', letterSpacing: '0.04em', color: '#fff1cd', marginBottom: '2px' }}>{label.toUpperCase()}</p>
        <p className="font-['Inter']" style={{ fontSize: '12px', color: 'rgba(255,241,205,0.40)' }}>{sub}</p>
      </div>
      <div
        className="flex-shrink-0 w-12 h-7 rounded-full relative transition-colors duration-200"
        style={{ background: on ? '#fff1cd' : 'rgba(255,241,205,0.18)' }}
      >
        <div
          className="absolute top-1 w-5 h-5 rounded-full transition-transform duration-200"
          style={{
            transform: on ? 'translateX(24px)' : 'translateX(4px)',
            background: on ? '#053980' : 'rgba(255,241,205,0.55)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
          }}
        />
      </div>
    </div>
  );
}
