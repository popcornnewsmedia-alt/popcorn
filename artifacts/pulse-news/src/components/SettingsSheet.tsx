import { useState, useRef, useCallback, useEffect } from "react";
import { X, ChevronRight, Pencil, ArrowRight, Eye, EyeOff } from "lucide-react";
import { GrainBackground } from "@/components/GrainBackground";
import { useAuth } from "@/hooks/use-auth";
import { APP_VERSION } from "@/pages/feed-internals";

/**
 * SettingsSheet — the account-management drawer opened from the avatar button
 * on the "You" screen.
 *
 * Three states stack behind a single bottom-sheet chrome:
 *   1. Root menu — ACCOUNT (display name, password) + DANGER ZONE (delete).
 *   2. Inline sub-forms for display-name and password edits (slide open
 *      directly below the row they expand from).
 *   3. Delete confirmation → farewell → onAccountDeleted callback fires,
 *      parent unmounts the sheet and returns to the splash/signed-out state.
 *
 * Visual language mirrors LegalSheet + UsernameSheet:
 *   - dark blue (#053980) bg with GrainBackground
 *   - cream (#fff1cd) copy, Macabro for labels/titles, Inter for body
 *   - box-shadow + GrainBackground gated on isOpen (see MEMORY.md — rainbow
 *     fringing bug from always-mounted sheets).
 */

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after the account has been permanently deleted and the user
   *  has been signed out. Parent should route back to splash/sign-in. */
  onAccountDeleted: () => void;
}

type Panel = "root" | "name" | "password" | "delete";

// Farewell state lives outside `Panel` because it briefly takes over the whole
// sheet after deletion succeeds — there's no "back" action from it.
type DeleteStage = "idle" | "confirming" | "deleting" | "farewell";

export function SettingsSheet({ isOpen, onClose, onAccountDeleted }: SettingsSheetProps) {
  const { user, profile, updateProfile, updatePassword, deleteAccount } = useAuth();

  const initialName = (user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? "";
  const handle = profile?.username ?? null;

  const [panel, setPanel] = useState<Panel>("root");
  const [deleteStage, setDeleteStage] = useState<DeleteStage>("idle");

  // ── Display-name form ───────────────────────────────────────────────────
  const [nameDraft, setNameDraft] = useState(initialName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  // ── Password form ───────────────────────────────────────────────────────
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  // ── Delete form ─────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reset all transient state whenever the sheet closes so re-opening feels
  // fresh. Keep the initial display-name draft in sync with user_metadata.
  useEffect(() => {
    if (isOpen) {
      setNameDraft(initialName);
      return;
    }
    // Small delay so state doesn't flash during the close animation.
    const t = setTimeout(() => {
      setPanel("root");
      setDeleteStage("idle");
      setNameError(null);
      setNameSuccess(false);
      setPw1("");
      setPw2("");
      setShowPw(false);
      setPwError(null);
      setPwSuccess(false);
      setDeleteConfirm("");
      setDeleteError(null);
    }, 320);
    return () => clearTimeout(t);
    // initialName intentionally only drives the open-branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Drag-down-to-close (scroll-aware) ───────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);
  const dragLocked = deleteStage === "deleting" || deleteStage === "farewell";

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (dragLocked) return;
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  }, [dragLocked]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    if (delta <= 0 || scrollTop > 2) { setDragOffset(0); return; }
    if (!isDragging.current && delta < 10) return;
    isDragging.current = true;
    setDragOffset(delta);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragStartY.current === null) return;
    dragStartY.current = null;
    if (dragOffset > 80) {
      setDragOffset(0);
      onClose();
    } else {
      setDragOffset(0);
    }
    isDragging.current = false;
  }, [dragOffset, onClose]);

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dragLocked) return;
    onClose();
  };

  // ── Handlers ────────────────────────────────────────────────────────────
  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameError("Name can't be empty.");
      return;
    }
    if (trimmed === initialName) {
      setPanel("root");
      return;
    }
    setNameSaving(true);
    setNameError(null);
    try {
      await updateProfile({ full_name: trimmed });
      setNameSuccess(true);
      // Let the green flash land for a beat, then collapse the row.
      setTimeout(() => {
        setNameSuccess(false);
        setPanel("root");
      }, 900);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't save — try again.";
      setNameError(msg);
    } finally {
      setNameSaving(false);
    }
  };

  const savePassword = async () => {
    if (pw1.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    if (pw1 !== pw2) {
      setPwError("Passwords don't match.");
      return;
    }
    setPwSaving(true);
    setPwError(null);
    try {
      await updatePassword(pw1);
      setPwSuccess(true);
      setPw1("");
      setPw2("");
      setTimeout(() => {
        setPwSuccess(false);
        setPanel("root");
      }, 1100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't update password.";
      setPwError(msg);
    } finally {
      setPwSaving(false);
    }
  };

  const canConfirmDelete = deleteConfirm.trim().toUpperCase() === "DELETE";

  const runDelete = async () => {
    if (!canConfirmDelete) return;
    setDeleteError(null);
    setDeleteStage("deleting");
    try {
      await deleteAccount();
      setDeleteStage("farewell");
      // Linger on the farewell for a beat so it registers emotionally, then
      // hand control back to the parent (which routes to splash/sign-in).
      setTimeout(() => {
        onAccountDeleted();
      }, 2600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't delete account.";
      setDeleteError(msg);
      setDeleteStage("confirming");
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <div
        className="fixed inset-0 z-[230] transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.72)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={handleClose}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[230] flex flex-col overflow-hidden mx-auto"
        style={{
          height: '90dvh',
          maxWidth: '480px',
          background: '#053980',
          borderRadius: '20px 20px 0 0',
          transform: isOpen ? `translateY(${dragOffset}px)` : 'translateY(100%)',
          transition: dragOffset > 0 ? 'none' : 'transform 0.38s cubic-bezier(0.32,0.72,0,1)',
          boxShadow: isOpen ? '0 -24px 64px rgba(0,0,0,0.45)' : 'none',
        }}
        onClick={stopProp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isOpen && <GrainBackground />}

        {/* Handle */}
        <div className="relative z-10 flex justify-center pt-3 pb-1 flex-shrink-0">
          <div
            className="w-9 h-1 rounded-full"
            style={{ background: 'rgba(255,241,205,0.30)', opacity: dragLocked ? 0.15 : 1 }}
          />
        </div>

        {/* Close (hidden during terminal delete stages) */}
        {!dragLocked && (
          <button
            onClick={handleClose}
            className="absolute right-5 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-60 active:opacity-50"
            style={{
              background: 'rgba(255,241,205,0.10)',
              top: 'calc(14px + env(safe-area-inset-top))',
            }}
            aria-label="Close"
          >
            <X className="w-4 h-4" style={{ color: 'rgba(255,241,205,0.80)' }} strokeWidth={2.25} />
          </button>
        )}

        {/* Farewell overlay takes the entire sheet when active */}
        {deleteStage === "farewell" ? (
          <FarewellPanel />
        ) : (
          <>
            {/* Header */}
            <div className="relative z-10 px-6 pt-6 pb-5 flex-shrink-0">
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 700,
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,241,205,0.38)',
                  marginBottom: '10px',
                }}
              >
                Popcorn · Account
              </p>
              <h1
                style={{
                  fontFamily: "'Macabro', 'Anton', sans-serif",
                  fontSize: 'clamp(22px, 6.6vw, 30px)',
                  lineHeight: 0.96,
                  color: '#fff1cd',
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                }}
              >
                Settings
              </h1>
              {handle && (
                <p
                  className="font-['Inter']"
                  style={{
                    marginTop: '10px',
                    fontSize: '12.5px',
                    color: 'rgba(255,241,205,0.50)',
                    letterSpacing: '0.01em',
                  }}
                >
                  Signed in as{" "}
                  <span style={{ color: '#fff1cd', fontWeight: 500 }}>@{handle}</span>
                </p>
              )}
            </div>

            {/* Divider */}
            <div
              className="relative z-10 mx-6"
              style={{ height: '1px', background: 'rgba(255,241,205,0.14)' }}
            />

            {/* Body — scroll container; individual rows expand inline */}
            <div
              ref={scrollRef}
              className="relative z-10 flex-1 overflow-y-auto overscroll-contain scrollbar-hide"
            >
              <div className="px-6 pt-6 pb-10">
                {/* ── ACCOUNT ──────────────────────────────────────────── */}
                <SectionLabel>Account</SectionLabel>

                <SettingsRow
                  label="Display name"
                  value={initialName || "Not set"}
                  onClick={() => {
                    setNameDraft(initialName);
                    setNameError(null);
                    setPanel(panel === "name" ? "root" : "name");
                  }}
                  open={panel === "name"}
                  icon={<Pencil className="w-3.5 h-3.5" style={{ color: 'rgba(255,241,205,0.55)' }} strokeWidth={2} />}
                />

                {panel === "name" && (
                  <InlinePanel>
                    <FieldLabel>New name</FieldLabel>
                    <input
                      type="text"
                      autoFocus
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      maxLength={60}
                      placeholder="Your name"
                      className="w-full rounded-xl px-4 py-3.5 outline-none font-['Inter']"
                      style={{
                        background: 'rgba(255,241,205,0.07)',
                        fontSize: '15px',
                        color: '#fff1cd',
                        border: `1px solid ${nameSuccess ? 'rgba(130,220,160,0.40)' : nameError ? 'rgba(255,150,130,0.40)' : 'rgba(255,241,205,0.13)'}`,
                      }}
                    />
                    {nameError && <InlineError>{nameError}</InlineError>}
                    {nameSuccess && <InlineSuccess>Saved.</InlineSuccess>}
                    <div className="flex items-center gap-3 mt-3">
                      <GhostButton onClick={() => setPanel("root")}>Cancel</GhostButton>
                      <PrimaryButton
                        onClick={saveName}
                        disabled={nameSaving || !nameDraft.trim() || nameDraft.trim() === initialName}
                      >
                        {nameSaving ? "SAVING…" : "SAVE"}
                      </PrimaryButton>
                    </div>
                  </InlinePanel>
                )}

                <SettingsRow
                  label="Password"
                  value="Change your password"
                  onClick={() => {
                    setPwError(null);
                    setPanel(panel === "password" ? "root" : "password");
                  }}
                  open={panel === "password"}
                />

                {panel === "password" && (
                  <InlinePanel>
                    <FieldLabel>New password</FieldLabel>
                    <div className="relative">
                      <input
                        type={showPw ? "text" : "password"}
                        autoFocus
                        value={pw1}
                        onChange={(e) => setPw1(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full rounded-xl pl-4 pr-11 py-3.5 outline-none font-['Inter']"
                        style={{
                          background: 'rgba(255,241,205,0.07)',
                          fontSize: '15px',
                          color: '#fff1cd',
                          border: '1px solid rgba(255,241,205,0.13)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-opacity hover:opacity-70"
                        aria-label={showPw ? "Hide password" : "Show password"}
                      >
                        {showPw ? (
                          <EyeOff className="w-4 h-4" style={{ color: 'rgba(255,241,205,0.50)' }} strokeWidth={2} />
                        ) : (
                          <Eye className="w-4 h-4" style={{ color: 'rgba(255,241,205,0.50)' }} strokeWidth={2} />
                        )}
                      </button>
                    </div>

                    <FieldLabel style={{ marginTop: '14px' }}>Confirm</FieldLabel>
                    <input
                      type={showPw ? "text" : "password"}
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                      placeholder="Re-type the new password"
                      className="w-full rounded-xl px-4 py-3.5 outline-none font-['Inter']"
                      style={{
                        background: 'rgba(255,241,205,0.07)',
                        fontSize: '15px',
                        color: '#fff1cd',
                        border: `1px solid ${pw2.length > 0 && pw1 === pw2 ? 'rgba(130,220,160,0.40)' : pw2.length > 0 ? 'rgba(255,150,130,0.40)' : 'rgba(255,241,205,0.13)'}`,
                      }}
                    />
                    {pw2.length > 0 && pw1 === pw2 && !pwError && (
                      <InlineSuccess>Passwords match.</InlineSuccess>
                    )}
                    {pwError && <InlineError>{pwError}</InlineError>}
                    {pwSuccess && <InlineSuccess>Password updated.</InlineSuccess>}
                    <div className="flex items-center gap-3 mt-3">
                      <GhostButton onClick={() => setPanel("root")}>Cancel</GhostButton>
                      <PrimaryButton
                        onClick={savePassword}
                        disabled={pwSaving || pw1.length < 8 || pw1 !== pw2}
                      >
                        {pwSaving ? "SAVING…" : "UPDATE"}
                      </PrimaryButton>
                    </div>
                  </InlinePanel>
                )}

                {/* ── DANGER ZONE ─────────────────────────────────────── */}
                <div style={{ height: '34px' }} />
                <SectionLabel danger>Danger zone</SectionLabel>

                {panel !== "delete" ? (
                  <button
                    onClick={() => {
                      setDeleteConfirm("");
                      setDeleteError(null);
                      setDeleteStage("confirming");
                      setPanel("delete");
                    }}
                    className="w-full text-left rounded-2xl px-4 py-4 transition-opacity hover:opacity-85 active:opacity-70"
                    style={{
                      background: 'rgba(189,69,60,0.08)',
                      border: '1px solid rgba(189,69,60,0.22)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p
                          style={{
                            fontFamily: "'Macabro', 'Anton', sans-serif",
                            fontSize: '11px',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            color: '#ffb3ab',
                            marginBottom: '4px',
                          }}
                        >
                          Delete account
                        </p>
                        <p
                          className="font-['Inter']"
                          style={{
                            fontSize: '12.5px',
                            color: 'rgba(255,241,205,0.55)',
                            lineHeight: 1.5,
                          }}
                        >
                          Permanently erase your account and all your data.
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(255,179,171,0.70)' }} strokeWidth={2.25} />
                    </div>
                  </button>
                ) : (
                  <DeleteConfirmPanel
                    stage={deleteStage}
                    value={deleteConfirm}
                    onChange={setDeleteConfirm}
                    error={deleteError}
                    canConfirm={canConfirmDelete}
                    onCancel={() => {
                      setDeleteStage("idle");
                      setPanel("root");
                      setDeleteConfirm("");
                      setDeleteError(null);
                    }}
                    onConfirm={runDelete}
                  />
                )}

                {/* Footer */}
                <div
                  style={{
                    marginTop: '44px',
                    paddingTop: '22px',
                    borderTop: '1px solid rgba(255,241,205,0.10)',
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      fontFamily: "'Macabro', 'Anton', sans-serif",
                      fontSize: '9px',
                      letterSpacing: '0.22em',
                      color: 'rgba(255,241,205,0.28)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Popcorn · v{APP_VERSION}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function SectionLabel({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <p
      style={{
        fontFamily: "'Macabro', 'Anton', sans-serif",
        fontSize: '10px',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: danger ? 'rgba(255,179,171,0.78)' : 'rgba(255,241,205,0.45)',
        marginBottom: '12px',
        paddingLeft: '2px',
      }}
    >
      {children}
    </p>
  );
}

interface SettingsRowProps {
  label: string;
  value: string;
  onClick: () => void;
  open: boolean;
  icon?: React.ReactNode;
}

function SettingsRow({ label, value, onClick, open, icon }: SettingsRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl px-4 py-3.5 mb-2 transition-opacity hover:opacity-85 active:opacity-70"
      style={{
        background: 'rgba(255,241,205,0.05)',
        border: `1px solid ${open ? 'rgba(255,241,205,0.22)' : 'rgba(255,241,205,0.10)'}`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            style={{
              fontFamily: "'Macabro', 'Anton', sans-serif",
              fontSize: '10px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,241,205,0.60)',
              marginBottom: '4px',
            }}
          >
            {label}
          </p>
          <p
            className="font-['Inter'] truncate"
            style={{
              fontSize: '14.5px',
              color: '#fff1cd',
              letterSpacing: '0.005em',
            }}
          >
            {value}
          </p>
        </div>
        <div className="flex-shrink-0">
          {icon ?? (
            <ChevronRight
              className="w-4 h-4 transition-transform"
              style={{
                color: 'rgba(255,241,205,0.45)',
                transform: open ? 'rotate(90deg)' : 'none',
              }}
              strokeWidth={2.25}
            />
          )}
        </div>
      </div>
    </button>
  );
}

function InlinePanel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl px-4 py-4 mb-2"
      style={{
        background: 'rgba(255,241,205,0.03)',
        border: '1px solid rgba(255,241,205,0.10)',
        animation: 'popcorn-settings-reveal 240ms cubic-bezier(0.32,0.72,0,1)',
      }}
    >
      <style>{`
        @keyframes popcorn-settings-reveal {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {children}
    </div>
  );
}

function FieldLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label
      style={{
        display: 'block',
        fontFamily: "'Macabro', 'Anton', sans-serif",
        fontSize: '9px',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'rgba(255,241,205,0.70)',
        marginBottom: '7px',
        ...style,
      }}
    >
      {children}
    </label>
  );
}

function InlineError({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-['Inter']"
      style={{
        fontSize: '12px',
        color: 'rgba(255,150,130,0.90)',
        marginTop: '8px',
        letterSpacing: '0.01em',
      }}
    >
      {children}
    </p>
  );
}

function InlineSuccess({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-['Inter']"
      style={{
        fontSize: '12px',
        color: 'rgba(130,220,160,0.90)',
        marginTop: '8px',
        letterSpacing: '0.01em',
      }}
    >
      {children}
    </p>
  );
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2.5 rounded-xl transition-opacity hover:opacity-70 active:opacity-60"
      style={{
        fontFamily: "'Macabro', 'Anton', sans-serif",
        fontSize: '11px',
        letterSpacing: '0.12em',
        color: 'rgba(255,241,205,0.70)',
        background: 'transparent',
        border: '1px solid rgba(255,241,205,0.14)',
      }}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-150 active:scale-[0.98]"
      style={{
        fontFamily: "'Macabro', 'Anton', sans-serif",
        fontSize: '12px',
        letterSpacing: '0.10em',
        background: disabled ? 'rgba(255,241,205,0.12)' : '#fff1cd',
        color: disabled ? 'rgba(255,241,205,0.32)' : '#053980',
      }}
    >
      {children}
      {!disabled && <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />}
    </button>
  );
}

// ─── Delete confirmation panel ─────────────────────────────────────────────

interface DeleteConfirmPanelProps {
  stage: DeleteStage;
  value: string;
  onChange: (v: string) => void;
  error: string | null;
  canConfirm: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteConfirmPanel({
  stage,
  value,
  onChange,
  error,
  canConfirm,
  onCancel,
  onConfirm,
}: DeleteConfirmPanelProps) {
  const busy = stage === "deleting";

  return (
    <div
      className="rounded-2xl px-5 py-5"
      style={{
        background: 'rgba(189,69,60,0.10)',
        border: '1px solid rgba(189,69,60,0.35)',
        animation: 'popcorn-danger-reveal 260ms cubic-bezier(0.32,0.72,0,1)',
      }}
    >
      <style>{`
        @keyframes popcorn-danger-reveal {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <p
        style={{
          fontFamily: "'Macabro', 'Anton', sans-serif",
          fontSize: '13px',
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: '#ffd8d2',
          marginBottom: '12px',
        }}
      >
        This can't be undone.
      </p>
      <p
        className="font-['Inter']"
        style={{
          fontSize: '13px',
          lineHeight: 1.55,
          color: 'rgba(255,241,205,0.78)',
          marginBottom: '16px',
        }}
      >
        This will permanently delete your account and all your data from our servers —
        your profile, comments, votes, and saved articles.
        <br />
        <br />
        Type{" "}
        <span
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            letterSpacing: '0.04em',
            color: '#fff1cd',
            background: 'rgba(255,241,205,0.08)',
            padding: '1px 6px',
            borderRadius: '4px',
          }}
        >
          DELETE
        </span>{" "}
        below to confirm.
      </p>

      <input
        type="text"
        autoFocus
        disabled={busy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="DELETE"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="w-full rounded-xl px-4 py-3.5 outline-none"
        style={{
          background: 'rgba(0,0,0,0.24)',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: '15px',
          letterSpacing: '0.10em',
          color: '#fff1cd',
          border: `1px solid ${canConfirm ? 'rgba(255,179,171,0.50)' : 'rgba(255,241,205,0.14)'}`,
          textAlign: 'center',
        }}
      />

      {error && <InlineError>{error}</InlineError>}

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={onCancel}
          disabled={busy}
          className="px-4 py-3 rounded-xl transition-opacity hover:opacity-70 active:opacity-60 disabled:opacity-40"
          style={{
            fontFamily: "'Macabro', 'Anton', sans-serif",
            fontSize: '11px',
            letterSpacing: '0.12em',
            color: '#fff1cd',
            background: 'transparent',
            border: '1px solid rgba(255,241,205,0.20)',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={!canConfirm || busy}
          className="flex-1 py-3 rounded-xl transition-all duration-150 active:scale-[0.98]"
          style={{
            fontFamily: "'Macabro', 'Anton', sans-serif",
            fontSize: '12px',
            letterSpacing: '0.12em',
            background: canConfirm && !busy ? '#bd453c' : 'rgba(189,69,60,0.22)',
            color: canConfirm && !busy ? '#fff1cd' : 'rgba(255,241,205,0.40)',
            boxShadow: canConfirm && !busy ? '0 4px 18px rgba(189,69,60,0.35)' : 'none',
          }}
        >
          {busy ? "DELETING…" : "DELETE MY ACCOUNT"}
        </button>
      </div>
    </div>
  );
}

// ─── Farewell ──────────────────────────────────────────────────────────────

function FarewellPanel() {
  return (
    <div
      className="relative z-10 flex-1 flex flex-col items-center justify-center px-8"
      style={{
        animation: 'popcorn-farewell 420ms cubic-bezier(0.32,0.72,0,1)',
      }}
    >
      <style>{`
        @keyframes popcorn-farewell {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        aria-hidden
        style={{
          fontFamily: "'Macabro', 'Anton', sans-serif",
          fontSize: '11px',
          letterSpacing: '0.26em',
          textTransform: 'uppercase',
          color: 'rgba(255,241,205,0.38)',
          marginBottom: '22px',
        }}
      >
        · farewell ·
      </div>

      <h2
        style={{
          fontFamily: "'Macabro', 'Anton', sans-serif",
          fontSize: 'clamp(30px, 9vw, 44px)',
          lineHeight: 0.94,
          letterSpacing: '0.015em',
          color: '#fff1cd',
          textAlign: 'center',
          textTransform: 'uppercase',
          marginBottom: '22px',
        }}
      >
        Sorry to see<br />you go.
      </h2>

      <p
        className="font-['Lora'] italic"
        style={{
          fontSize: '15px',
          lineHeight: 1.55,
          color: 'rgba(255,241,205,0.72)',
          textAlign: 'center',
          maxWidth: '320px',
        }}
      >
        We hope you'll be back.
      </p>

      <div
        style={{
          marginTop: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: 'rgba(255,241,205,0.35)',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'currentColor',
            animation: 'popcorn-farewell-dot 1.2s ease-in-out infinite',
          }}
        />
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'currentColor',
            animation: 'popcorn-farewell-dot 1.2s ease-in-out 0.18s infinite',
          }}
        />
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'currentColor',
            animation: 'popcorn-farewell-dot 1.2s ease-in-out 0.36s infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes popcorn-farewell-dot {
          0%, 80%, 100% { opacity: 0.25; }
          40%           { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

