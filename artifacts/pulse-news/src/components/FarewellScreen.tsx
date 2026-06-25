import { useEffect, useState } from "react";
import { GrainBackground } from "@/components/GrainBackground";

/**
 * Full-screen farewell shown AFTER an account is deleted. Rendered at the App
 * level (triggered by a localStorage flag + the "popcorn:farewell" event set in
 * useAuth.deleteAccount) rather than inside the settings UI — because deleting
 * the account signs the user out, which unmounts the settings modal (it's gated
 * on `user`) before any in-component farewell could show. "Back to Popcorn"
 * clears the flag and reloads into the signed-out site.
 */
export function FarewellScreen() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleDone = () => {
    try { localStorage.removeItem("popcorn_farewell"); } catch { /* ignore */ }
    window.location.assign(import.meta.env.BASE_URL || "/");
  };

  return (
    <div
      className="fixed inset-0 z-[600] flex flex-col"
      style={{ background: "#042c85", opacity: visible ? 1 : 0, transition: "opacity 0.4s ease" }}
    >
      <GrainBackground />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div
          aria-hidden
          style={{
            fontFamily: "'Macabro', 'Anton', sans-serif",
            fontSize: "11px",
            letterSpacing: "0.26em",
            textTransform: "uppercase",
            color: "rgba(255,241,205,0.38)",
            marginBottom: "22px",
          }}
        >
          · farewell ·
        </div>
        <h1
          style={{
            fontFamily: "'Macabro', 'Anton', sans-serif",
            fontSize: "clamp(30px, 9vw, 44px)",
            lineHeight: 0.94,
            letterSpacing: "0.015em",
            color: "#fff1cd",
            textTransform: "uppercase",
            marginBottom: "18px",
          }}
        >
          Sorry to see<br />you go.
        </h1>
        <p
          className="font-['Lora'] italic"
          style={{ fontSize: "15px", lineHeight: 1.55, color: "rgba(255,241,205,0.72)", maxWidth: "320px" }}
        >
          We're sorry to see you go, but we hope you'll be back soon.
        </p>
      </div>

      <div className="relative z-10 flex justify-center px-6 pb-12">
        <button
          onClick={handleDone}
          className="w-full py-4 rounded-2xl transition-all duration-150 active:scale-[0.98]"
          style={{
            maxWidth: "360px",
            fontFamily: "'Macabro', 'Anton', sans-serif",
            fontSize: "14px",
            letterSpacing: "0.08em",
            background: "#fff1cd",
            color: "#042c85",
          }}
        >
          BACK TO POPCORN
        </button>
      </div>
    </div>
  );
}
