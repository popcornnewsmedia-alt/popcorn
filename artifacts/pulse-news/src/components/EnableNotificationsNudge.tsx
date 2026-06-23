import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { promptEnablePush } from "@/lib/push-registration";

interface EnableNotificationsNudgeProps {
  getAccessToken: () => Promise<string | null>;
  /** Called when the banner closes. `enabled` = permission was granted. */
  onClose: (outcome: "enabled" | "dismissed") => void;
}

/**
 * Discreet bottom banner that nudges the user to turn on notifications. Slides
 * up above the BottomNav, brand blue + cream. Tapping "Enable" shows the OS
 * permission dialog (and registers for APNs on grant). If iOS has already been
 * told "Don't Allow", Apple won't re-prompt — we then show a short hint to flip
 * it on in Settings instead. Frequency/visibility is owned by the parent.
 */
export function EnableNotificationsNudge({ getAccessToken, onClose }: EnableNotificationsNudgeProps) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deniedHint, setDeniedHint] = useState(false);

  // Slide in on the next frame so the transition runs.
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  const close = (outcome: "enabled" | "dismissed") => {
    setVisible(false);
    setTimeout(() => onClose(outcome), 280);
  };

  const handleEnable = async () => {
    if (busy) return;
    setBusy(true);
    const status = await promptEnablePush(getAccessToken);
    setBusy(false);
    if (status === "granted") {
      close("enabled");
    } else if (status === "denied") {
      // OS won't show the dialog again — guide them to Settings.
      setDeniedHint(true);
    } else {
      close("dismissed");
    }
  };

  return (
    <div
      className="fixed z-40 left-0 right-0 flex justify-center px-4 pointer-events-none"
      style={{
        top: "calc(var(--pn-topbar-h, 64px) + 10px)",
        transform: `translateY(${visible ? "0px" : "-16px"})`,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.28s ease, transform 0.28s cubic-bezier(0.32,0.72,0,1)",
      }}
    >
      <div
        className="pointer-events-auto w-full"
        style={{
          maxWidth: 440,
          background: "#042c85",
          borderRadius: 18,
          border: "1px solid rgba(255,241,205,0.16)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
          padding: "14px 14px 14px 16px",
        }}
      >
        {deniedHint ? (
          <div className="flex items-start gap-3">
            <Bell style={{ width: 18, height: 18, color: "#fff1cd", flexShrink: 0, marginTop: 1 }} strokeWidth={1.8} />
            <div className="flex-1">
              <p
                className="font-['Manrope']"
                style={{ color: "#fff1cd", fontSize: "13.5px", lineHeight: 1.4, fontWeight: 600 }}
              >
                Notifications are off
              </p>
              <p
                className="font-['Manrope'] mt-0.5"
                style={{ color: "rgba(255,241,205,0.75)", fontSize: "12.5px", lineHeight: 1.45 }}
              >
                Turn them on in iOS Settings › Popcorn › Notifications.
              </p>
            </div>
            <button
              onClick={() => close("dismissed")}
              className="active:scale-90 transition-transform"
              style={{ padding: 4, flexShrink: 0 }}
              aria-label="Dismiss"
            >
              <X style={{ width: 16, height: 16, color: "rgba(255,241,205,0.55)" }} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: "rgba(255,241,205,0.12)",
              }}
            >
              <Bell style={{ width: 18, height: 18, color: "#fff1cd" }} strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="font-['Manrope']"
                style={{ color: "#fff1cd", fontSize: "13px", lineHeight: 1.4, fontWeight: 500 }}
              >
                Get notified the moment your daily feed is live.
                <span style={{ color: "rgba(255,241,205,0.6)" }}> Just one a day, never spam.</span>
              </p>
            </div>
            <button
              onClick={handleEnable}
              disabled={busy}
              className="active:scale-95 transition-transform flex-shrink-0"
              style={{
                background: "#fff1cd",
                color: "#042c85",
                fontFamily: "Manrope, sans-serif",
                fontWeight: 700,
                fontSize: "12.5px",
                letterSpacing: "0.01em",
                padding: "8px 14px",
                borderRadius: 999,
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? "…" : "Enable"}
            </button>
            <button
              onClick={() => close("dismissed")}
              className="active:scale-90 transition-transform flex-shrink-0"
              style={{ padding: 2 }}
              aria-label="Dismiss"
            >
              <X style={{ width: 16, height: 16, color: "rgba(255,241,205,0.5)" }} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
