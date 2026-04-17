import { useState, useEffect } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { GrainBackground } from "@/components/GrainBackground";
import { supabase } from "@/lib/supabase";
import {
  checkAvailability,
  validateUsernameFormat,
  seedUsername,
  type AvailabilityReason,
  type FormatReason,
} from "@/lib/username";

// Blocking handle-picker used for Google OAuth first-sign-in (and as a safety
// net for email-signup users who somehow landed without a profiles row).
//
// The sheet cannot be dismissed — no close button, no backdrop tap, no
// drag-down. The user must pick a valid handle to continue.
interface UsernameSheetProps {
  isOpen: boolean;
  userId: string;
  defaultSeed?: string;
  onComplete: () => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "bad_format"; reason: FormatReason }
  | { kind: "unavailable"; reason: AvailabilityReason };

export function UsernameSheet({ isOpen, userId, defaultSeed, onComplete }: UsernameSheetProps) {
  const [username, setUsername] = useState(() => seedUsername(defaultSeed ?? ""));
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Debounced availability check ─────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const raw = username.trim().toLowerCase();
    if (!raw) { setStatus({ kind: "idle" }); return; }
    const fmt = validateUsernameFormat(raw);
    if (!fmt.ok) { setStatus({ kind: "bad_format", reason: fmt.reason }); return; }
    setStatus({ kind: "checking" });
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await checkAvailability(raw);
      if (cancelled) return;
      if (raw !== username.trim().toLowerCase()) return;
      if (r.available) setStatus({ kind: "ok" });
      else setStatus({ kind: "unavailable", reason: r.reason });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [username, isOpen]);

  const canSubmit = status.kind === "ok" && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const candidate = username.trim().toLowerCase();
      const { error } = await supabase
        .from("profiles")
        .insert({ user_id: userId, username: candidate });
      if (error) {
        const code = (error as { code?: string }).code;
        if (code === "23505") {
          setStatus({ kind: "unavailable", reason: "taken" });
          return;
        }
        setSubmitError(error.message || "Something went wrong — try again.");
        return;
      }
      // Notify listeners (useAuth) so the "You" screen + comment-author snapshot
      // pick up the new username without a page reload.
      window.dispatchEvent(new CustomEvent("popcorn:profile-updated"));
      onComplete();
    } catch (err: any) {
      setSubmitError(err?.message || "Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const hint = formatStatusHint(status);
  const hintColor =
    status.kind === "ok"
      ? "rgba(130,220,160,0.90)"
      : status.kind === "checking" || status.kind === "idle"
        ? "rgba(255,241,205,0.45)"
        : "rgba(255,150,130,0.90)";

  return (
    <>
      {/* Solid backdrop — non-interactive (no dismiss-on-tap) */}
      <div
        className="fixed inset-0 z-[230] transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.72)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[230] flex flex-col overflow-hidden mx-auto"
        style={{
          height: '90dvh',
          maxWidth: '480px',
          background: '#053980',
          borderRadius: '20px 20px 0 0',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.36s cubic-bezier(0.32,0.72,0,1)',
          // Gate box-shadow on isOpen to avoid off-screen bleed (see MEMORY.md)
          boxShadow: isOpen ? '0 -16px 48px rgba(0,0,0,0.32)' : undefined,
        }}
      >
        {isOpen && <GrainBackground />}

        {/* Handle (decorative only — sheet does not support drag-to-close) */}
        <div className="relative z-10 flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,241,205,0.20)' }} />
        </div>

        <div className="relative z-10 flex-1 flex flex-col px-6 pt-7 pb-5 gap-6 overflow-y-auto">
          <div>
            <h2 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '30px', color: '#fff1cd', lineHeight: 1.0, letterSpacing: '0.02em', marginBottom: '8px' }}>
              PICK YOUR<br />HANDLE.
            </h2>
            <p className="font-['Inter']" style={{ fontSize: '13px', color: 'rgba(255,241,205,0.55)', lineHeight: 1.55 }}>
              This is how other readers will see you in comments. You can't change it later (for now).
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#fff1cd' }}>
              Username
            </label>
            <div className="relative">
              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none font-['Inter']"
                style={{ fontSize: '15px', color: 'rgba(255,241,205,0.45)' }}
              >
                @
              </span>
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="your_handle"
                maxLength={20}
                className="w-full rounded-xl pl-8 pr-10 py-3.5 outline-none font-['Inter'] placeholder-[rgba(255,241,205,0.22)]"
                style={{
                  background: 'rgba(255,241,205,0.07)',
                  fontSize: '15px',
                  color: '#fff1cd',
                  border: `1px solid ${status.kind === "ok" ? 'rgba(130,220,160,0.40)' : status.kind === "unavailable" || status.kind === "bad_format" ? 'rgba(255,150,130,0.40)' : 'rgba(255,241,205,0.13)'}`,
                }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                {status.kind === "ok" && <Check className="w-4 h-4" style={{ color: 'rgba(130,220,160,0.90)' }} strokeWidth={2.75} />}
                {status.kind === "unavailable" && <X className="w-4 h-4" style={{ color: 'rgba(255,150,130,0.90)' }} strokeWidth={2.75} />}
                {status.kind === "bad_format" && <X className="w-4 h-4" style={{ color: 'rgba(255,150,130,0.70)' }} strokeWidth={2.5} />}
              </span>
            </div>
            {hint && (
              <p className="font-['Inter']" style={{ fontSize: '11.5px', color: hintColor, marginTop: '2px' }}>
                {hint}
              </p>
            )}
            {submitError && (
              <p className="font-['Inter']" style={{ fontSize: '12.5px', color: '#ff8a80', marginTop: '4px' }}>{submitError}</p>
            )}
          </div>
        </div>

        <div className="relative z-10 px-6 pb-10 pt-4 flex-shrink-0">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl transition-all duration-150 active:scale-[0.98]"
            style={{
              fontFamily: "'Macabro', 'Anton', sans-serif",
              fontSize: '14px',
              letterSpacing: '0.08em',
              background: canSubmit ? '#fff1cd' : 'rgba(255,241,205,0.12)',
              color: canSubmit ? '#053980' : 'rgba(255,241,205,0.28)',
            }}
          >
            {submitting ? "SAVING…" : "CLAIM HANDLE"}
            {!submitting && <ArrowRight className="w-4 h-4" strokeWidth={2.5} />}
          </button>
        </div>
      </div>
    </>
  );
}

function formatStatusHint(status: Status): string | null {
  switch (status.kind) {
    case "idle":
      return "3–20 chars, letters / numbers / underscore.";
    case "checking":
      return "Checking availability…";
    case "ok":
      return "Available.";
    case "bad_format":
      switch (status.reason) {
        case "too_short": return "Too short — at least 3 characters.";
        case "too_long":  return "Too long — 20 characters max.";
        case "bad_chars": return "Letters, numbers, and underscore only.";
        case "reserved":  return "That handle is reserved.";
      }
      return "Invalid handle.";
    case "unavailable":
      switch (status.reason) {
        case "taken":    return "That handle is already taken.";
        case "reserved": return "That handle is reserved.";
        case "format":   return "Invalid handle.";
        case "network":  return "Couldn't check availability — try again.";
      }
      return "Unavailable.";
  }
}
