import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import type { NewsArticle } from "@workspace/api-client-react";
import { fetchArticleById } from "@/lib/article-by-id";
import { ArticleReader } from "@/components/ArticleReader";
import { GrainBackground } from "@/components/GrainBackground";

/**
 * Standalone reader for a shared link (/a/:id).
 *
 * Opens the article on the public website so a recipient WITHOUT the app can
 * read it — no login required. Closing the reader (or the "Browse Popcorn"
 * link) drops them onto the home feed, which is the discover/get-the-app
 * surface. Liking or commenting while signed out routes home, where the auth
 * flow lives.
 */
export function SharedArticleRoute({ id }: { id: number }) {
  const [, navigate] = useLocation();
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [article, setArticle] = useState<NewsArticle | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!Number.isFinite(id) || id <= 0) { setState("missing"); return; }
    setState("loading");
    void fetchArticleById(id).then((a) => {
      if (cancelled) return;
      if (a) { setArticle(a); setState("ready"); }
      else setState("missing");
    });
    return () => { cancelled = true; };
  }, [id]);

  const goHome = () => navigate("/");

  if (state === "ready" && article) {
    return (
      <ArticleReader
        article={article}
        onClose={goHome}
        onRequireAuth={goHome}
      />
    );
  }

  // Loading + not-found share the same branded blue surface.
  return (
    <div
      className="fixed inset-0 z-[400] flex flex-col items-center justify-center px-8 text-center"
      style={{ background: "#042c85" }}
    >
      <GrainBackground />
      <div className="relative z-10">
        {state === "loading" ? (
          <p
            className="animate-pulse"
            style={{
              fontFamily: "'Macabro', 'Anton', sans-serif",
              fontSize: 22,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#fff1cd",
            }}
          >
            Popcorn
          </p>
        ) : (
          <>
            <p
              style={{
                fontFamily: "'Macabro', 'Anton', sans-serif",
                fontSize: 20,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "#fff1cd",
                marginBottom: 10,
              }}
            >
              Story not found
            </p>
            <p className="font-['Lora']" style={{ fontSize: 13.5, lineHeight: 1.6, color: "rgba(255,241,205,0.75)", marginBottom: 22 }}>
              This article may have moved on. Catch today's edition instead.
            </p>
            <button
              onClick={goHome}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: 13,
                color: "#042c85",
                background: "#fff1cd",
                borderRadius: 999,
                padding: "10px 22px",
              }}
            >
              Browse Popcorn
            </button>
          </>
        )}
      </div>
    </div>
  );
}
