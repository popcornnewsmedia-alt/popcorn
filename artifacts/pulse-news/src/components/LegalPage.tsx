import { PRIVACY, TERMS, ABOUT, type LegalDoc, type LegalKind } from "@/components/LegalSheet";
import { GrainBackground } from "@/components/GrainBackground";

const DOCS: Record<LegalKind, LegalDoc> = { privacy: PRIVACY, terms: TERMS, about: ABOUT };

/**
 * Standalone, crawlable full-page version of a legal doc, served at /privacy,
 * /terms, /about. The same content also appears as an in-app modal (LegalSheet),
 * but Google's OAuth verification (and good practice) needs a real linkable URL
 * — and the homepage links to /privacy from the auth footer + gate.
 */
export function LegalPage({ kind }: { kind: LegalKind }) {
  const doc = DOCS[kind];
  const eyebrow = kind === "about" ? "Popcorn · About" : "Popcorn · Legal";
  return (
    <div className="relative min-h-screen w-full" style={{ background: "#042c85" }}>
      {/* Fixed full-viewport grain layer so the texture stays behind the
          content the whole way down (the canvas is sized to its parent, so a
          fixed viewport-sized parent keeps it covering every scroll position). */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <GrainBackground />
      </div>
      <div className="relative z-10 mx-auto px-6 py-10 pb-24" style={{ maxWidth: 720 }}>
        <a
          href="/"
          className="font-['Inter']"
          style={{ display: "inline-block", marginBottom: "28px", fontSize: "13px", fontWeight: 600, color: "rgba(255,241,205,0.8)", textDecoration: "none" }}
        >
          ← Popcorn
        </a>

        <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,241,205,0.38)", marginBottom: "10px" }}>
          {eyebrow}
        </p>
        <h1 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "clamp(28px, 6vw, 40px)", lineHeight: 0.96, color: "#fff1cd", letterSpacing: "0.015em", textTransform: "uppercase", whiteSpace: "pre-line" }}>
          {doc.title}
        </h1>
        <p className="font-['Inter']" style={{ marginTop: "12px", fontSize: "12px", color: "rgba(255,241,205,0.45)", letterSpacing: "0.02em" }}>
          Last updated {doc.lastUpdated}
        </p>

        <div className="mt-7" style={{ height: "1px", background: "rgba(255,241,205,0.14)" }} />

        <div className="pt-7">
          {doc.intro && (
            <p className="font-['Lora'] italic" style={{ fontSize: "13.5px", lineHeight: 1.7, color: "rgba(255,241,205,0.78)", marginBottom: "30px", borderLeft: "2px solid rgba(255,241,205,0.22)", paddingLeft: "14px" }}>
              {doc.intro}
            </p>
          )}

          {doc.sections.map((s, i) => (
            <section key={i} style={{ marginBottom: "28px" }}>
              <h2 style={{ display: "flex", alignItems: "baseline", gap: "10px", fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "12px", letterSpacing: "0.10em", color: "#fff1cd", textTransform: "uppercase", marginBottom: "10px" }}>
                <span className="font-['Inter']" style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.04em", color: "rgba(255,241,205,0.38)", width: "18px" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.heading}
              </h2>
              {s.paragraphs.map((p, j) => (
                <p key={j} className="font-['Lora']" style={{ fontSize: "13.5px", lineHeight: 1.75, color: "rgba(255,241,205,0.78)", marginLeft: "28px", marginBottom: j === s.paragraphs.length - 1 ? 0 : "12px" }}>
                  {p}
                </p>
              ))}
            </section>
          ))}

          <div style={{ marginTop: "36px", paddingTop: "20px", borderTop: "1px solid rgba(255,241,205,0.10)", textAlign: "center" }}>
            <p className="font-['Inter']" style={{ fontSize: "11px", color: "rgba(255,241,205,0.38)", letterSpacing: "0.04em", lineHeight: 1.6 }}>
              Questions? Write to us at <span style={{ color: "#fff1cd" }}>hello@popcornmedia.org</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
