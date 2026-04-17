import { useState, useEffect, useRef, useCallback } from "react";
import { X, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { GrainBackground } from "@/components/GrainBackground";
import type { LegalKind } from "@/components/LegalSheet";
import { apiBase } from "@/lib/api-base";

interface SignInSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSignUpInstead: () => void;
  onOpenLegal?: (kind: LegalKind) => void;
  initialEmail?: string;
}

export function SignInSheet({ isOpen, onClose, onSignUpInstead, onOpenLegal, initialEmail }: SignInSheetProps) {
  // `identifier` accepts an email OR a username. We resolve username → email
  // on submit via /api/auth/resolve-identifier before calling signIn.
  const [identifier, setIdentifier] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, signInWithGoogle } = useAuth();

  // Pre-fill when redirected from sign-up (existing account detected)
  useEffect(() => {
    if (initialEmail) setIdentifier(initialEmail);
  }, [initialEmail]);

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();
  const reset = () => { setIdentifier(""); setPassword(""); setError(null); setLoading(false); };
  const handleClose = (e: React.MouseEvent) => { e.stopPropagation(); reset(); onClose(); };

  // ── Drag-down-to-close ──────────────────────────────────────────────────
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta <= 0) { setDragOffset(0); return; }
    if (!isDragging.current && delta < 10) return;
    isDragging.current = true;
    setDragOffset(delta);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragStartY.current === null) return;
    dragStartY.current = null;
    if (dragOffset > 80) {
      setDragOffset(0);
      reset();
      onClose();
    } else {
      setDragOffset(0);
    }
    isDragging.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragOffset, onClose]);

  const handleSignIn = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    setLoading(true);
    const apiUrl = apiBase();
    const trimmed = identifier.trim();
    // Strip a single leading "@" so users can type "@handle" (the placeholder
    // literally invites this). Without this, `includes("@")` would classify
    // "@bharatarora" as an email and hand it to Supabase, which 401s.
    const raw = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
    const isEmail = raw.includes("@");

    try {
      // If the user typed a username, resolve it to an email first.
      let emailForSignIn = raw;
      if (!isEmail) {
        try {
          const resp = await fetch(`${apiUrl}/api/auth/resolve-identifier`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: raw }),
          });
          const data = await resp.json();
          if (!data?.email) {
            setError("No account found with that username. Please create an account first.");
            setLoading(false);
            return;
          }
          emailForSignIn = data.email;
        } catch {
          setError("Couldn't look up that username — check your connection and try again.");
          setLoading(false);
          return;
        }
      }

      await signIn(emailForSignIn, password);
      reset();
      onClose();
    } catch (err: any) {
      const msg = (err.message ?? "").toLowerCase();
      if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials")) {
        if (isEmail) {
          // Supabase returns the same error for "no account" and "wrong password".
          // Check if the email is registered so we can show a more helpful message.
          try {
            const resp = await fetch(`${apiUrl}/api/auth/check`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind: "email", value: raw }),
            });
            const data = await resp.json();
            if (!data.exists) {
              setError("No account found with this email. Please create an account first.");
            } else {
              setError("Incorrect password. Please try again.");
            }
          } catch {
            setError("Incorrect email or password. Please try again.");
          }
        } else {
          // Username resolved, so the account exists — only the password can be wrong.
          setError("Incorrect password. Please try again.");
        }
      } else if (msg.includes("email not confirmed")) {
        setError("Your email hasn't been verified yet. Check your inbox for a confirmation link.");
      } else if (msg.includes("too many requests") || msg.includes("rate limit")) {
        setError("Too many attempts. Please wait a moment and try again.");
      } else {
        setError(err.message ?? "Sign in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
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

  // Accept an email (must contain "@") OR a username (3-20 chars, letters/numbers/underscore).
  // Strip a leading "@" so "@handle" — which the placeholder invites — validates
  // as a username instead of tripping the email classifier and failing.
  // Server-side resolver enforces the real check; this is just to gate the button.
  const trimmedIdentifier = identifier.trim();
  const stripped = trimmedIdentifier.startsWith("@") ? trimmedIdentifier.slice(1) : trimmedIdentifier;
  const looksLikeEmail = stripped.includes("@");
  const looksLikeUsername = /^[a-z0-9_]{3,20}$/i.test(stripped);
  const canSubmit = (looksLikeEmail || looksLikeUsername) && password.length >= 6;

  return (
    <>
      <div
        className="fixed inset-0 z-[220] transition-opacity duration-300"
        style={{ background: 'rgba(0,0,0,0.65)', opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none' }}
        onClick={handleClose}
      />

      <div
        className="fixed inset-x-0 bottom-0 z-[220] flex flex-col overflow-hidden mx-auto"
        style={{
          maxWidth: '480px',
          background: '#053980',
          borderRadius: '20px 20px 0 0',
          transform: isOpen ? `translateY(${dragOffset}px)` : 'translateY(100%)',
          transition: dragOffset > 0 ? 'none' : 'transform 0.36s cubic-bezier(0.32,0.72,0,1)',
        }}
        onClick={stopProp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isOpen && <GrainBackground />}

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

        {/* Content */}
        <div className="relative z-10 flex flex-col px-6 pt-7 pb-5 gap-6">
          {/* Heading */}
          <div>
            <h2 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '15px', color: '#fff1cd', lineHeight: 1, letterSpacing: '0.02em' }}>
              WELCOME BACK.
            </h2>
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#fff1cd' }}>Email or username</label>
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                onClick={stopProp}
                placeholder="you@example.com or @handle"
                className="w-full rounded-xl px-4 py-3.5 outline-none font-['Inter'] placeholder-[rgba(255,241,205,0.22)]"
                style={{ background: 'rgba(255,241,205,0.07)', fontSize: '15px', color: '#fff1cd', border: '1px solid rgba(255,241,205,0.13)' }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#fff1cd' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onClick={stopProp}
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-3.5 outline-none font-['Inter'] placeholder-[rgba(255,241,205,0.22)]"
                style={{ background: 'rgba(255,241,205,0.07)', fontSize: '15px', color: '#fff1cd', border: '1px solid rgba(255,241,205,0.13)' }}
              />
            </div>

            {error && (
              <p className="font-['Inter']" style={{ fontSize: '13px', color: '#ff8a80' }}>{error}</p>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 my-0.5">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,241,205,0.12)' }} />
              <span className="font-['Inter']" style={{ fontSize: '11px', color: 'rgba(255,241,205,0.25)' }}>or</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,241,205,0.12)' }} />
            </div>

            {/* Google */}
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

        {/* CTA */}
        <div className="relative z-10 px-6 pb-10 pt-1 flex flex-col gap-3 flex-shrink-0">
          <button
            onClick={handleSignIn}
            disabled={!canSubmit || loading}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl transition-all duration-150 active:scale-[0.98]"
            style={{
              fontFamily: "'Macabro', 'Anton', sans-serif",
              fontSize: '14px',
              letterSpacing: '0.08em',
              background: canSubmit && !loading ? '#fff1cd' : 'rgba(255,241,205,0.12)',
              color: canSubmit && !loading ? '#053980' : 'rgba(255,241,205,0.28)',
            }}
          >
            {loading ? "SIGNING IN…" : "SIGN IN"}
            {!loading && <ArrowRight className="w-4 h-4" strokeWidth={2.5} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); reset(); onClose(); onSignUpInstead(); }}
            className="w-full py-2.5 text-center font-['Inter'] font-medium"
            style={{ fontSize: '13px', color: 'rgba(255,241,205,0.38)' }}
          >
            No account?{" "}
            <span style={{ color: '#fff1cd', fontWeight: 600 }}>Create one</span>
          </button>
          {onOpenLegal && (
            <p
              className="font-['Inter']"
              style={{
                textAlign: 'center',
                fontSize: '10.5px',
                lineHeight: 1.55,
                color: 'rgba(255,241,205,0.35)',
                marginTop: '-4px',
              }}
            >
              By signing in you agree to our{" "}
              <button
                onClick={(e) => { e.stopPropagation(); onOpenLegal("terms"); }}
                className="inline"
                style={{ color: 'rgba(255,241,205,0.72)', borderBottom: '1px solid rgba(255,241,205,0.28)', fontWeight: 600 }}
              >
                Terms
              </button>{" "}
              &{" "}
              <button
                onClick={(e) => { e.stopPropagation(); onOpenLegal("privacy"); }}
                className="inline"
                style={{ color: 'rgba(255,241,205,0.72)', borderBottom: '1px solid rgba(255,241,205,0.28)', fontWeight: 600 }}
              >
                Privacy
              </button>.{" · "}
              <button
                onClick={(e) => { e.stopPropagation(); onOpenLegal("about"); }}
                className="inline"
                style={{ color: 'rgba(255,241,205,0.72)', borderBottom: '1px solid rgba(255,241,205,0.28)', fontWeight: 600 }}
              >
                About Popcorn
              </button>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
