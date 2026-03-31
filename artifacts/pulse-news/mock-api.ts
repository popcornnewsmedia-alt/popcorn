/**
 * Local development mock API — serves articles via the Vite dev server.
 *
 * When ANTHROPIC_API_KEY is set in the environment, this middleware
 * kicks off an RSS-fetch + Claude enrichment pass in the background.
 * Until that finishes (or if no key is set) it falls back to the
 * curated static dataset below.
 *
 * Injected via vite.config.ts `configureServer`.
 */
import type { Connect } from "vite";
import { loadLiveArticles } from "./rss-enricher.js";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

function dateAt(daysBack: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

// ─── Static fallback dataset ─────────────────────────────────────────────────
const STATIC_ARTICLES = [
  {
    id: 1,
    title: "GPT-5 Confirmed: OpenAI's Most Capable Model Ships This Quarter",
    summary: "Sam Altman confirms GPT-5 will be released before the end of the quarter, with leaked benchmark results suggesting a major leap over o3.",
    content: `After months of speculation, OpenAI CEO Sam Altman confirmed today that GPT-5 is on track for a public release within the current quarter. The announcement comes amid growing competitive pressure from Anthropic, Google DeepMind, and an increasingly capable open-source ecosystem.\n\nLeaked benchmark results paint a striking picture. On MMLU, GPT-5 reportedly scores in the 92nd percentile — a meaningful step above GPT-4's already strong performance. On mathematical reasoning benchmarks, the improvements are even more pronounced.\n\nFor the AI industry, the release will test whether capability gains from one generation to the next are still large enough to justify the cost of training at frontier scale.`,
    keyPoints: ["GPT-5 confirmed for release this quarter by Sam Altman", "Benchmarks show 92nd percentile on MMLU", "Mathematical reasoning improvements are the most pronounced gains", "Competitive pressure from Anthropic, DeepMind, and open-source is mounting"],
    impact: "Frontier AI competition accelerates.",
    signalScore: 88,
    category: "Models",
    source: "The Verge",
    readTimeMinutes: 4,
    publishedAt: dateAt(0, 9),
    likes: 8241,
    isBookmarked: false,
    gradientStart: "#1e1e2e",
    gradientEnd: "#4a4a7a",
    tag: "BREAKING",
    imageUrl: "https://images.unsplash.com/photo-1677442136019-21780ecad979?w=800&q=80",
  },
  {
    id: 2,
    title: "The New Memory Layer: How AI Is Learning to Remember",
    summary: "A wave of startups and frontier labs are racing to solve AI's memory problem — and the approaches couldn't be more different.",
    content: `Every conversation you have with a frontier AI model begins from scratch. It has no memory of what you discussed yesterday, last week, or last year. For casual use, this is a minor inconvenience. For the kinds of ambient, always-on AI assistants that companies are now building, it's a fundamental limitation.\n\nSolving AI memory has become one of the most contested problems in applied AI research. The approaches on offer are wildly different, reflecting genuine uncertainty about what "memory" should even mean for a machine intelligence.`,
    keyPoints: ["Current frontier models have no persistent memory across sessions", "Three competing approaches: retrieval augmentation, memory compression, native pretraining", "Retrieval works for facts but misses stylistic and preference memory"],
    impact: "Whoever solves persistent AI memory first gains a significant moat.",
    signalScore: 72,
    category: "Research",
    source: "MIT Technology Review",
    readTimeMinutes: 6,
    publishedAt: dateAt(0, 11),
    likes: 3102,
    isBookmarked: false,
    gradientStart: "#0a2a1a",
    gradientEnd: "#3a7a5a",
    tag: "ANALYSIS",
    imageUrl: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&q=80",
  },
  {
    id: 3,
    title: "Nvidia's H200 Sells Out for 2026 as AI Infrastructure Boom Accelerates",
    summary: "The chip giant reports its latest GPU is fully allocated through end of 2026, with waiting lists extending into 2027.",
    content: `Nvidia's H200, the successor to the H100, is sold out for the remainder of 2026. The company confirmed the allocation status in a call with investors, noting that demand has significantly outpaced even their most optimistic internal projections.\n\nThe H200's improvements over its predecessor are meaningful: roughly 1.8x the memory bandwidth and higher memory capacity.`,
    keyPoints: ["H200 fully allocated through end of 2026, waitlists into 2027", "1.8x memory bandwidth improvement over H100 drives strong demand", "AMD, Cerebras, and Groq gaining share as customers seek alternatives"],
    impact: "The supply squeeze widens the gap between well-capitalised frontier labs and everyone else.",
    signalScore: 61,
    category: "Industry",
    source: "The Information",
    readTimeMinutes: 4,
    publishedAt: dateAt(0, 14),
    likes: 2876,
    isBookmarked: false,
    gradientStart: "#2a1a0a",
    gradientEnd: "#8a6a3a",
    tag: "INDUSTRY",
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
  },
  {
    id: 4,
    title: "Anthropic's Constitutional AI Grows Up",
    summary: "Three years after the original paper, the technique behind Claude's safety guardrails is being deployed at a scale the original researchers never imagined.",
    content: `When Anthropic published the Constitutional AI paper in December 2022, the research community received it with a mixture of curiosity and skepticism. Training AI systems to critique themselves using a written "constitution" of values seemed elegant in theory — but would it hold at scale?\n\nThe answer, three years later, appears to be yes.`,
    keyPoints: ["Constitutional AI now deployed across all Claude model generations", "Dynamic constitutions replace static rule sets", "Safety improvements have paradoxically also improved helpfulness"],
    impact: "Constitutional AI is becoming the de facto safety standard for large language models.",
    signalScore: 79,
    category: "Research",
    source: "Machine Intelligence Review",
    readTimeMinutes: 6,
    publishedAt: dateAt(1, 8),
    likes: 2567,
    isBookmarked: false,
    gradientStart: "#2a1a1a",
    gradientEnd: "#8a5a5a",
    tag: "RESEARCH",
    imageUrl: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80",
  },
  {
    id: 5,
    title: "Cursor and the Future of AI-Native Development",
    summary: "The IDE that put AI at the centre of coding has raised at a $9B valuation. But the real story is what happens to software development as a profession.",
    content: `Cursor's growth trajectory has been one of the more remarkable stories in enterprise software. Starting as an AI-enhanced fork of VS Code, it has captured a loyal following among professional developers who describe it not as a productivity tool but as a fundamentally different way of writing software.\n\nThe latest funding round — $900M at a $9 billion valuation — reflects investor conviction that AI-native development tooling is a winner-take-most market.`,
    keyPoints: ["$900M raised at $9B valuation", "Raw code output up dramatically; developer time shifting to architecture and judgment", "AI-native IDEs redefining what 'coding' means as a professional skill"],
    impact: "The productivity gains are real but so are the skill-formation risks.",
    signalScore: 66,
    category: "Tools",
    source: "Software Futures",
    readTimeMinutes: 6,
    publishedAt: dateAt(1, 12),
    likes: 3445,
    isBookmarked: false,
    gradientStart: "#1a0a2a",
    gradientEnd: "#6a3a8a",
    tag: "INDUSTRY",
    imageUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80",
  },
  {
    id: 6,
    title: "The Hidden Cost of AI Inference",
    summary: "As AI adoption scales, the energy demands of inference are becoming a more pressing concern than training.",
    content: `The conversation around AI's environmental impact has historically focused on training. But inference, the process of generating outputs from a trained model, is increasingly the dominant energy cost.\n\nGoogle's integration of AI into search is estimated to have increased per-query energy consumption by a factor of five to ten.`,
    keyPoints: ["Inference now outpacing training as the dominant AI energy cost", "Google AI search integration raised per-query energy use by 5–10x", "Purpose-built inference chips gaining traction"],
    impact: "As inference costs compound, energy becomes a competitive differentiator.",
    signalScore: 55,
    category: "Industry",
    source: "Data Centre Dynamics",
    readTimeMinutes: 6,
    publishedAt: dateAt(1, 16),
    likes: 2134,
    isBookmarked: false,
    gradientStart: "#2a1a2a",
    gradientEnd: "#7a5a7a",
    tag: "ANALYSIS",
    imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80",
  },
  {
    id: 7,
    title: "Google DeepMind's AlphaFold 3 Unlocks Drug Design",
    summary: "The latest version of the protein structure predictor can model entire molecular systems — potentially compressing decades of pharmaceutical research into months.",
    content: `AlphaFold 3 is a more ambitious leap than its predecessors. Where previous versions focused on proteins in isolation, AF3 can model the interactions between proteins, DNA, RNA, and small molecules simultaneously.\n\nEarly results from pharmaceutical partners are striking.`,
    keyPoints: ["AlphaFold 3 models full molecular systems", "Virtual screening results rival years of traditional medicinal chemistry", "Previously undruggable protein-protein interaction targets now accessible"],
    impact: "Drug discovery timelines could compress by a decade or more.",
    signalScore: 91,
    category: "Research",
    source: "Nature Biotechnology",
    readTimeMinutes: 8,
    publishedAt: dateAt(2, 9),
    likes: 4102,
    isBookmarked: false,
    gradientStart: "#0a2a1a",
    gradientEnd: "#3a7a5a",
    tag: "BREAKTHROUGH",
    imageUrl: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80",
  },
  {
    id: 8,
    title: "OpenAI's o3-mini Quietly Overtakes GPT-4 on Coding Benchmarks",
    summary: "Internal evaluations suggest the compact model outperforms its larger predecessor on software engineering tasks — at one-fifth the inference cost.",
    content: `The o3-mini, released with relatively little fanfare, has been quietly accumulating benchmark victories in domains where its larger sibling GPT-4 once dominated. On HumanEval, SWE-Bench, and several proprietary coding assessments, o3-mini is posting scores that not only match GPT-4 — they exceed it.`,
    keyPoints: ["o3-mini outperforms GPT-4 on HumanEval and SWE-Bench", "Chain-of-thought distillation transfers GPT-4 reasoning into a compact model", "Inference cost is one-fifth of GPT-4"],
    impact: "If small distilled models consistently beat large generalists on specialised tasks, the economics of AI deployment shift dramatically.",
    signalScore: 83,
    category: "Models",
    source: "AI Insider",
    readTimeMinutes: 5,
    publishedAt: dateAt(2, 11),
    likes: 3201,
    isBookmarked: false,
    gradientStart: "#1e1e2e",
    gradientEnd: "#4a4a7a",
    tag: "BREAKING",
    imageUrl: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80",
  },
  {
    id: 9,
    title: "The EU AI Act Enters Its Compliance Phase",
    summary: "With enforcement deadlines now active, European companies are scrambling to audit their systems — and discovering that compliance is harder than expected.",
    content: `The European Union's AI Act was signed into law with considerable optimism. Now, as enforcement deadlines arrive, a more complicated picture is emerging.\n\nCompliance officers across the continent are discovering that the Act's risk-tiered framework is more ambiguous in practice than it appeared on paper.`,
    keyPoints: ["EU AI Act enforcement deadlines now active", "High-risk classification is proving ambiguous; healthcare is most contested", "Some companies withdrawing AI products from EU markets rather than comply"],
    impact: "Europe risks becoming a second-tier market for AI-powered products.",
    signalScore: 58,
    category: "Policy",
    source: "Tech Policy Review",
    readTimeMinutes: 7,
    publishedAt: dateAt(2, 15),
    likes: 1923,
    isBookmarked: false,
    gradientStart: "#1a1a2a",
    gradientEnd: "#5a6a9a",
    tag: "POLICY",
    imageUrl: "https://images.unsplash.com/photo-1436262513933-a0b06755c784?w=800&q=80",
  },
  {
    id: 10,
    title: "Sam Altman on What Comes After ChatGPT",
    summary: "In a rare long-form interview, OpenAI's CEO sketches out a vision for AI that sounds less like a product roadmap and more like a theory of civilisation.",
    content: `Sam Altman laid out a vision for AI's future that, whether you find it inspiring or terrifying, is worth understanding.\n\nThe central thesis: AGI, broadly defined as AI systems that can perform any cognitive task a human can, is likely to arrive within the current decade.`,
    keyPoints: ["Altman treats within-decade AGI as a planning assumption, not speculation", "Post-AGI economic acceleration framed as a civilisational inflection point", "AI dividend concept — broad distribution of productivity gains via UBI-style mechanisms"],
    impact: "Strategy built around imminent AGI will look very different from strategy built around incremental improvement.",
    signalScore: 48,
    category: "Industry",
    source: "Stratechery",
    readTimeMinutes: 9,
    publishedAt: dateAt(3, 17),
    likes: 5213,
    isBookmarked: false,
    gradientStart: "#2a2a1a",
    gradientEnd: "#8a8a4a",
    tag: "INTERVIEW",
    imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
  },
];

// ─── Live state ───────────────────────────────────────────────────────────────
// Starts as the static fallback; replaced by live RSS articles once loaded.
type ArticleRecord = typeof STATIC_ARTICLES[0];
let liveArticles: ArticleRecord[] = STATIC_ARTICLES.map((a) => ({ ...a }));
let isLive = false;

/**
 * Kick off the RSS + Claude enrichment pass in the background.
 * Called once at server start — safe to call multiple times (no-op after first).
 */
export function startRSSRefresh(): void {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("[api] No ANTHROPIC_API_KEY — serving static articles.");
    return;
  }
  console.log("[api] ANTHROPIC_API_KEY detected — starting RSS refresh…");
  loadLiveArticles()
    .then((articles) => {
      // Preserve any in-session likes/bookmarks if re-loading
      const prevById = new Map(liveArticles.map((a) => [a.id, a]));
      liveArticles = (articles as ArticleRecord[]).map((a) => {
        const prev = prevById.get(a.id);
        return prev ? { ...a, likes: prev.likes, isBookmarked: prev.isBookmarked } : { ...a };
      });
      isLive = true;
      console.log(`[api] ✓ Switched to ${liveArticles.length} live RSS articles.`);
    })
    .catch((err: Error) => {
      console.error("[api] RSS refresh failed — keeping static articles:", err.message);
    });
}

// ─── Middleware factory ───────────────────────────────────────────────────────

export function mockApiMiddleware(): Connect.NextHandleFunction {
  return function (req, res, next) {
    const url = new URL(req.url!, `http://localhost`);
    const pathname = url.pathname;

    if (!pathname.startsWith("/api/")) {
      return next();
    }

    res.setHeader("Content-Type", "application/json");
    // Handy for the client to know when live data is being served
    res.setHeader("X-Popcorn-Live", isLive ? "1" : "0");

    // GET /api/news
    if (req.method === "GET" && pathname === "/api/news") {
      const page = parseInt(url.searchParams.get("page") ?? "1");
      const limit = parseInt(url.searchParams.get("limit") ?? "10");
      const category = url.searchParams.get("category");

      let filtered =
        category && category !== "All"
          ? liveArticles.filter((a) => a.category === category)
          : liveArticles;

      const offset = (page - 1) * limit;
      const slice = filtered.slice(offset, offset + limit + 1);
      const hasMore = slice.length > limit;
      if (hasMore) slice.pop();

      res.end(
        JSON.stringify({
          articles: slice,
          total: filtered.length,
          page,
          limit,
          hasMore,
          isLive,
        })
      );
      return;
    }

    // GET /api/categories
    if (req.method === "GET" && pathname === "/api/categories") {
      const cats = Array.from(new Set(liveArticles.map((a) => a.category)));
      res.end(JSON.stringify({ categories: ["All", ...cats] }));
      return;
    }

    // GET /api/status
    if (req.method === "GET" && pathname === "/api/status") {
      res.end(JSON.stringify({ isLive, articleCount: liveArticles.length }));
      return;
    }

    // POST /api/news/:id/like
    const likeMatch = pathname.match(/^\/api\/news\/(\d+)\/like$/);
    if (req.method === "POST" && likeMatch) {
      const id = parseInt(likeMatch[1]);
      const article = liveArticles.find((a) => a.id === id);
      if (!article) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }
      article.likes += 1;
      res.end(JSON.stringify({ id: article.id, likes: article.likes }));
      return;
    }

    // POST /api/news/:id/bookmark
    const bookmarkMatch = pathname.match(/^\/api\/news\/(\d+)\/bookmark$/);
    if (req.method === "POST" && bookmarkMatch) {
      const id = parseInt(bookmarkMatch[1]);
      const article = liveArticles.find((a) => a.id === id);
      if (!article) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }
      article.isBookmarked = !article.isBookmarked;
      res.end(JSON.stringify({ id: article.id, isBookmarked: article.isBookmarked }));
      return;
    }

    // GET /api/news/:id
    const articleMatch = pathname.match(/^\/api\/news\/(\d+)$/);
    if (req.method === "GET" && articleMatch) {
      const id = parseInt(articleMatch[1]);
      const article = liveArticles.find((a) => a.id === id);
      if (!article) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }
      res.end(JSON.stringify(article));
      return;
    }

    next();
  };
}
