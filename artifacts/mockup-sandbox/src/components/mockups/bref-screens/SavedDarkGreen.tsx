import { Bookmark, Clock } from "lucide-react";

const ARTICLES = [
  {
    tag: "BREAKING",
    title: "GPT-5 Confirmed: OpenAI's Most Capable Model Ships This Quarter",
    source: "The Verge",
    readTime: 4,
    color: "#2d3a4a",
  },
  {
    tag: "ANALYSIS",
    title: "The New Memory Layer: How AI Is Learning to Remember",
    source: "MIT Technology Review",
    readTime: 6,
    color: "#2a3d35",
  },
  {
    tag: "INDUSTRY",
    title: "Nvidia's H200 Sells Out for 2026 as AI Infrastructure Boom Accelerates",
    source: "The Information",
    readTime: 4,
    color: "#3a2a2a",
  },
  {
    tag: "RESEARCH",
    title: "Constitutional AI Grows Up: Three Years On",
    source: "Machine Intelligence Review",
    readTime: 6,
    color: "#2a2a3d",
  },
];

export function SavedDarkGreen() {
  return (
    <div
      className="relative h-screen w-full flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #1a4430 0%, #2c523e 60%, #162e22 100%)",
      }}
    >
      {/* Atmospheric blobs */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-10%", left: "-15%", width: "60%", height: "50%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: "5%", right: "-10%", width: "55%", height: "45%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(100,200,140,0.08) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />

      {/* Header */}
      <div className="relative z-10 px-5 pt-16 pb-4">
        <h2
          className="font-['Manrope'] font-bold"
          style={{ fontSize: "26px", color: "#ffffff" }}
        >
          Saved
        </h2>
        <p className="font-['Inter'] mt-0.5" style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)" }}>
          {ARTICLES.length} articles
        </p>
      </div>

      {/* Article list */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-24 flex flex-col gap-3">
        {ARTICLES.map((article, i) => (
          <div
            key={i}
            className="w-full text-left rounded-2xl overflow-hidden flex gap-0"
            style={{
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            {/* Colour swatch instead of image */}
            <div className="w-24 h-24 flex-shrink-0" style={{ background: article.color }} />
            <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
              <div className="flex flex-col gap-1">
                <span
                  className="font-['Inter'] font-semibold uppercase tracking-widest"
                  style={{ fontSize: "9px", color: "rgba(255,255,255,0.40)" }}
                >
                  {article.tag}
                </span>
                <p
                  className="font-['Manrope'] font-bold leading-snug line-clamp-2"
                  style={{ fontSize: "13px", color: "#ffffff" }}
                >
                  {article.title}
                </p>
              </div>
              <p
                className="font-['Inter'] mt-1 flex items-center gap-1"
                style={{ fontSize: "11px", color: "rgba(255,255,255,0.38)" }}
              >
                {article.source} · {article.readTime} min
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom nav pill */}
      <div className="absolute bottom-0 inset-x-0 flex justify-center pb-4 pointer-events-none">
        <div
          className="flex items-center gap-1 px-3 py-2.5"
          style={{
            background: "rgba(0,0,0,0.30)",
            backdropFilter: "blur(32px)",
            borderRadius: "100px",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {["house", "bookmark", "user"].map((icon, i) => (
            <div
              key={icon}
              className="flex items-center justify-center"
              style={{
                width: 52, height: 44,
                borderRadius: 80,
                background: i === 1 ? "rgba(255,255,255,0.15)" : "transparent",
              }}
            >
              <Bookmark
                style={{
                  width: 20, height: 20,
                  color: i === 1 ? "#ffffff" : "rgba(255,255,255,0.40)",
                  fill: i === 1 ? "#ffffff" : "none",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
