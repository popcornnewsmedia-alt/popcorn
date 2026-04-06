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

function dateAt(_daysBack: number, hour: number): string {
  // All static articles are stamped as today — no historical days
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

// ─── Static fallback dataset ─────────────────────────────────────────────────
const STATIC_ARTICLES = [
  {
    id: 1,
    title: "The Album That Just Broke Every Streaming Record",
    summary: "A surprise drop from one of music's biggest names has shattered first-week streaming records — and reignited the debate about what a rollout even means anymore.",
    content: `Nobody saw it coming. A midnight drop, zero singles, zero promo cycle — just 17 tracks and a cover image that immediately became a meme. By morning, every streaming platform had a new record to report.\n\nWhat's remarkable isn't just the numbers. It's what this release strategy signals about where the music industry's power has shifted. Labels used to be the gatekeepers of rollout. Now the biggest artists are proving the rollout itself is optional.\n\nFor the culture, this is a genuine inflection point. The surprise album — once a novelty — is becoming the prestige format of choice for artists who have enough pull to dispense with the machine entirely.\n\nWhether the music itself lives up to the spectacle is, almost beside the point. The event was the point.`,
    keyPoints: ["First-week streams broke platform records across Spotify, Apple Music, and Tidal", "Zero traditional promo cycle — no singles, no press run", "Cover art became a viral meme within hours of release", "Industry insiders split on whether this model is replicable or artist-tier exclusive"],
    impact: "The surprise drop is becoming the prestige format — and labels are watching nervously.",
    signalScore: 91,
    category: "Music",
    source: "Pitchfork",
    readTimeMinutes: 4,
    publishedAt: dateAt(0, 9),
    likes: 9140,
    isBookmarked: false,
    gradientStart: "#1a0e2e",
    gradientEnd: "#4a2a6a",
    tag: "BREAKING",
    imageUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80",
  },
  {
    id: 2,
    title: "The Film Everyone Will Be Arguing About This Summer",
    summary: "A polarising auteur returns with a three-hour provocation that Cannes either loved or walked out of — sometimes both.",
    content: `Cannes has always been a place where films are made into events, and this year's most talked-about entry arrived with exactly the kind of baggage the festival thrives on. A three-hour runtime. A director known for testing audiences. And a premiere that ended in both a standing ovation and a mid-screening walkout from at least a dozen critics.\n\nThe film is dense, demanding, and at times genuinely difficult to watch. It is also, by several accounts, the most formally ambitious work its director has produced. Whether that makes it a masterpiece or an indulgence is the question that will follow it all the way to its wide release.\n\nWhat's certain is that it has already succeeded at the most important thing a prestige film can do right now: get people talking before they've even seen it.\n\nThe discourse is the first act. The actual film is what comes after.`,
    keyPoints: ["Standing ovation at Cannes despite mid-screening walkouts", "Three-hour runtime sparks debate on theatrical patience", "Director's most formally ambitious work to date, per early reviews", "Wide release scheduled for late summer"],
    impact: "In an era of safe franchise fare, a film that provokes this much debate is its own category of cultural event.",
    signalScore: 78,
    category: "Film & TV",
    source: "Variety",
    readTimeMinutes: 4,
    publishedAt: dateAt(0, 11),
    likes: 5830,
    isBookmarked: false,
    gradientStart: "#0e1a2e",
    gradientEnd: "#2a3f6a",
    tag: "FEATURE",
    imageUrl: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80",
  },
  {
    id: 3,
    title: "Gaming's Biggest Release Is Also Its Most Divisive",
    summary: "A long-awaited sequel shipped to record sales and immediate controversy — the speedrun community found a gamebreaking exploit within six hours.",
    content: `Day one of a major release used to mean launch parties and review scores. Now it means watching the speedrun community dismantle your carefully crafted world in real time.\n\nThe exploit in question — a physics glitch that allows players to skip roughly 40% of the game's content — was documented, replicated, and posted to YouTube within six hours of launch. The developer's response has been carefully worded: they're "evaluating" whether to patch it.\n\nHere's the cultural tension: a significant portion of the fanbase doesn't want the exploit patched. Speedrunning has become as legitimate a form of play as the intended experience, and policing it is increasingly seen as anti-community.\n\nThe numbers are impressive regardless. Record-breaking launch sales, server queues at peak, and a social media footprint that dwarfed everything else in the cultural conversation for a full 48 hours. Whatever you think of the exploit, the game has landed.`,
    keyPoints: ["Record-breaking launch sales across all platforms", "Gamebreaking exploit discovered within 6 hours by speedrun community", "Developer 'evaluating' a patch — community divided on whether they should", "Review scores strong but discourse dominated by the exploit story"],
    impact: "The speedrunning community vs. developer patch tension is now a first-week ritual for every major release.",
    signalScore: 82,
    category: "Gaming",
    source: "IGN",
    readTimeMinutes: 4,
    publishedAt: dateAt(0, 14),
    likes: 7210,
    isBookmarked: false,
    gradientStart: "#0a1e14",
    gradientEnd: "#1e5a38",
    tag: "BREAKING",
    imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&q=80",
  },
  {
    id: 4,
    title: "Why Every Brand Suddenly Looks the Same",
    summary: "From fast food to luxury fashion, a visual homogenisation is creeping across global branding — and the cause is more interesting than you'd think.",
    content: `Look at any brand refresh from the past three years and you'll notice something: they're all starting to look like each other. Rounded sans-serifs. Muted earth tones. A certain deliberate messiness that reads as 'authentic'. The logo gets flattened. The tagline gets shorter.\n\nThis isn't a coincidence, and it's not purely a design trend. It's the output of the same few consultancies, the same AI-assisted mood-boarding tools, and the same consumer research methodology being applied to every brief from every category.\n\nThe fashion end of this is particularly striking. Labels that once built entire identities around distinctive visual DNA are iterating toward a shared aesthetic that could, in the worst cases, belong to anyone.\n\nThe irony: in an era obsessed with authenticity, the visual language of authenticity has itself become a template.`,
    keyPoints: ["Brand redesigns converging on a shared aesthetic vocabulary", "Same consultancies and tools producing similar outputs across categories", "Luxury fashion labels moving toward generic 'quiet' aesthetics", "Consumer research homogenisation driving visual risk-aversion"],
    impact: "When every brand tries to look 'real', nothing does.",
    signalScore: 65,
    category: "Fashion",
    source: "Dazed",
    readTimeMinutes: 4,
    publishedAt: dateAt(1, 8),
    likes: 4102,
    isBookmarked: false,
    gradientStart: "#1e0a12",
    gradientEnd: "#6a1e36",
    tag: "HOT TAKE",
    imageUrl: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=800&q=80",
  },
  {
    id: 5,
    title: "The Show Nobody Expected to Be the Year's Best",
    summary: "A mid-season pickup from a streaming platform that's had a rough year just became the most-talked-about drama on television.",
    content: `Nobody had it on their radar. It wasn't adapted from IP. The showrunner wasn't a household name. The cast was excellent but not conventionally star-powered. And yet here we are, three episodes in, and it's the only thing anyone in television actually wants to talk about.\n\nWhat the show gets right is almost impossible to legislate for. The pacing is patient without being slow. The dialogue is sharp without showing off. It understands its characters with a depth that most prestige television only pretends to.\n\nStreaming platforms have trained audiences to expect volume over curation — dozens of decent shows rather than a handful of great ones. This is the rare exception. It's the kind of television that reminds you what the form is capable of when everyone involved is operating at their best.\n\nThe question now is whether the platform knows what it has, and whether it can resist the impulse to green-light a second season before the first one has even finished its run.`,
    keyPoints: ["Unheralded mid-season pickup becoming the year's most discussed drama", "No IP, no traditional stars — pure craft carrying the weight", "Streaming's volume-over-quality problem makes genuine breakouts rarer", "Second season pressure already reportedly being applied by the network"],
    impact: "The best thing on TV right now, and a reminder that quality still cuts through.",
    signalScore: 74,
    category: "Film & TV",
    source: "The Hollywood Reporter",
    readTimeMinutes: 4,
    publishedAt: dateAt(1, 12),
    likes: 6340,
    isBookmarked: false,
    gradientStart: "#0e1a2e",
    gradientEnd: "#2a3f6a",
    tag: "REVIEW",
    imageUrl: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800&q=80",
  },
  {
    id: 6,
    title: "The Science of Why Earworms Won't Let You Go",
    summary: "Cognitive researchers have finally mapped the neural loop behind involuntary musical imagery — and the findings explain a lot about which songs go viral.",
    content: `You know the experience: a fragment of a song lodges itself in your head and refuses to leave for hours. Cognitive scientists call it involuntary musical imagery, and for the first time, researchers have a fairly complete picture of the neural mechanics behind it.\n\nThe short version: earworms exploit the brain's predictive processing systems. When a melody has a gap — an unexpected note, a truncated phrase, an unresolved chord — the brain keeps trying to complete it. The more familiar the surrounding context and the more surprising the deviation, the stickier the loop.\n\nWhat makes this culturally interesting is that the same pattern appears, with striking consistency, in the songs that become the most viral. Hit songwriters have been intuiting this for decades. Now there's a neurological map to show why it works.\n\nThis has implications beyond music. The same mechanism — surprising deviation within a familiar frame — appears to drive virality in visual content, memes, and short-form video. The brain's completion drive is the algorithm underneath the algorithm.`,
    keyPoints: ["Neural loop mapped: earworms exploit predictive processing gaps", "Unexpected notes in familiar melodies create compulsive mental replay", "Pattern matches viral music structure with unusual consistency", "Same mechanism may explain virality in visual content and short-form video"],
    impact: "The neuroscience of earworms is the neuroscience of virality — same brain, same trap.",
    signalScore: 70,
    category: "Culture",
    source: "Nautilus",
    readTimeMinutes: 5,
    publishedAt: dateAt(1, 16),
    likes: 3870,
    isBookmarked: false,
    gradientStart: "#1a1208",
    gradientEnd: "#5a3e18",
    tag: "FEATURE",
    imageUrl: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=800&q=80",
  },
  {
    id: 7,
    title: "Indie Music Is Having Its Most Interesting Year in a Decade",
    summary: "While the mainstream compresses toward a handful of global superstars, the margins of music are producing something genuinely strange and alive.",
    content: `The centre of music has never been more consolidated. A vanishingly small number of artists account for a disproportionate share of streams, radio play, and cultural conversation. The superstar economy in music is more extreme than at any point in the streaming era.\n\nAnd yet: the margins have rarely been more interesting. The tools for making and distributing music are cheap and accessible. The algorithmic discovery pipes, however imperfect, do surface genuinely unusual work to audiences who would never have found it otherwise.\n\nWhat's emerging is a wave of artists operating completely outside the traditional industry structure — not as an aesthetic or political statement, but simply because the structure is no longer necessary for building a real, committed audience.\n\nThe music being made at these edges is stranger, less polished, and more emotionally direct than most of what the mainstream is producing. It's not going to top any charts. But it's where the next five years of music are being incubated.`,
    keyPoints: ["Superstar economy at peak consolidation — top 1% dominating streams", "Cheap tools enabling genuinely experimental artists to build real audiences", "Algorithmic discovery surfacing unusual work despite platform incentives", "Margins of music more creatively alive than the mainstream in years"],
    impact: "The mainstream and the underground have never been more separate — or more simultaneously vital.",
    signalScore: 68,
    category: "Music",
    source: "Pitchfork",
    readTimeMinutes: 5,
    publishedAt: dateAt(2, 9),
    likes: 4520,
    isBookmarked: false,
    gradientStart: "#1a0e2e",
    gradientEnd: "#4a2a6a",
    tag: "FEATURE",
    imageUrl: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&q=80",
  },
  {
    id: 8,
    title: "The Sneaker Resale Market Is Collapsing — Good",
    summary: "After years of artificial scarcity and hype economics, the secondary sneaker market is in freefall. The culture that created it is starting to reckon with what it actually valued.",
    content: `The numbers are grim for resellers. Average resale premiums on hyped drops have fallen dramatically from their 2021 peaks. Several major resale platforms have laid off staff or pivoted their business models. The flippers are hurting.\n\nFor the people who actually love sneakers — who care about design, craft, and the cultural history embedded in a particular silhouette — the correction is welcome. The hype economy turned footwear into a financial instrument, and the culture paid for it in exclusion and inflated prices.\n\nWhat's replacing it is more interesting. Brands are experimenting with different release models. The secondary market for genuinely rare vintage pieces remains healthy. And the community conversation has shifted from 'what's the resale value' back to 'do these actually look good'.\n\nIt's a deflation of a bubble, with all the wreckage that implies. But underneath the wreckage, something more honest is emerging.`,
    keyPoints: ["Resale premiums on hype drops down significantly from 2021 peaks", "Major resale platforms cutting staff and pivoting business models", "Brands experimenting with new release formats as hype model falters", "Community discourse shifting from resale value back to design quality"],
    impact: "The sneaker bubble bursting is the best thing that's happened to sneaker culture in years.",
    signalScore: 62,
    category: "Fashion",
    source: "The Cut",
    readTimeMinutes: 4,
    publishedAt: dateAt(2, 11),
    likes: 5670,
    isBookmarked: false,
    gradientStart: "#1e0a12",
    gradientEnd: "#6a1e36",
    tag: "HOT TAKE",
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
  },
  {
    id: 9,
    title: "The Unexpected Comeback That Has Hollywood Rethinking IP",
    summary: "A franchise written off as dead returned to deliver the year's biggest opening weekend — and nobody in the industry can quite explain why it worked.",
    content: `Nobody greenlights a revival of a franchise that failed twice. Nobody except the studio that just had the biggest opening weekend of the year with exactly that bet.\n\nThe film in question was written off after its second instalment underperformed. The IP sat dormant for years, considered a lesson in the limits of brand extension. And then, quietly, a new creative team was given an unusual amount of latitude. The result is a film that feels, against all odds, like it was made by people who cared.\n\nThe industry is now doing what it always does: reverse-engineering a success into a methodology. Was it the casting? The director? The campaign? The gap between instalments?\n\nThe honest answer is probably simpler: it was a good film. Which, in the current landscape of franchise filmmaking, is the explanation the industry is least equipped to process.`,
    keyPoints: ["Twice-failed franchise delivered biggest opening weekend of the year", "New creative team given unusual latitude — result is unusually personal", "Industry reverse-engineering the success into a methodology", "The uncomfortable truth: it just happened to be a good film"],
    impact: "Hollywood keeps searching for the formula, and the formula keeps being 'make something good'.",
    signalScore: 76,
    category: "Film & TV",
    source: "Deadline",
    readTimeMinutes: 4,
    publishedAt: dateAt(2, 15),
    likes: 6100,
    isBookmarked: false,
    gradientStart: "#0e1a2e",
    gradientEnd: "#2a3f6a",
    tag: "FEATURE",
    imageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80",
  },
  {
    id: 10,
    title: "Open World Games Are Getting Too Big to Finish",
    summary: "As map sizes hit new extremes, a growing number of players are abandoning games at the 20-hour mark — and developers are starting to notice.",
    content: `The completion rate data is brutal. A significant proportion of players who buy open world games never see the credits. The bigger the map, the worse the falloff. Some of the most technically impressive releases of the past two years have completion rates that wouldn't have been acceptable in a previous era.\n\nThis is partly a time problem. Players have more games and less time. But it's also a design problem. The open world formula has become self-replicating: more icons, more side quests, more collectibles, more systems layered on systems. The world gets bigger but not necessarily better.\n\nA counter-movement is building among both developers and critics. Tighter scopes, shorter runtimes, games designed to be actually finished are being celebrated in ways they haven't been in years.\n\nThe prestige of the 100-hour epic is fading. What comes next might look more like a short story — and that might be exactly what the medium needs.`,
    keyPoints: ["Completion rates for major open world titles declining significantly", "Map sizes at historic highs; player drop-off at the 20-hour mark a growing problem", "Counter-movement building around tighter, shorter, more completable game design", "Short-form prestige games gaining critical and commercial traction"],
    impact: "Bigger stopped meaning better, and the games industry is only just catching up.",
    signalScore: 71,
    category: "Gaming",
    source: "The Verge Games",
    readTimeMinutes: 4,
    publishedAt: dateAt(3, 10),
    likes: 5230,
    isBookmarked: false,
    gradientStart: "#0a1e14",
    gradientEnd: "#1e5a38",
    tag: "HOT TAKE",
    imageUrl: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&q=80",
  },
  {
    id: 11,
    title: "What the Internet Gets Wrong About Nostalgia",
    summary: "Everything is a revival, a reboot, or a 'core' right now. A cultural historian explains why, and what we're actually looking for when we reach for the past.",
    content: `Nostalgia has always been with us, but its current form is something different. It used to be slow — a gentle warmth for things genuinely gone. What we have now is accelerated, algorithmic, and often for things that never quite existed the way we remember them.\n\nThe 'core' phenomenon — cottagecore, dark academia, Y2K, coastal grandmother — is nostalgia for aesthetic moods rather than specific eras. People aren't longing for the 1990s; they're longing for a feeling they associate with a filtered image of the 1990s. The past as a mood board.\n\nCultural historians have a term for this: postnostalgia. It's not about going back; it's about the comfort of a past that's safe enough to be curated. The present is overwhelming and uncertain. The past, even an imaginary one, isn't.\n\nUnderstanding this doesn't make the trend less interesting. If anything, it makes it more so. What we're nostalgic for tells us everything about what we're afraid of right now.`,
    keyPoints: ["'Core' aesthetics represent nostalgia for feelings, not specific eras", "Algorithmic amplification has accelerated and fractured nostalgic cycles", "Cultural historians define 'postnostalgia' — the curated, safe past", "What we're nostalgic for reveals what we're anxious about in the present"],
    impact: "The internet didn't invent nostalgia, but it made it load faster.",
    signalScore: 66,
    category: "Culture",
    source: "Nautilus",
    readTimeMinutes: 5,
    publishedAt: dateAt(3, 14),
    likes: 4780,
    isBookmarked: false,
    gradientStart: "#1a1208",
    gradientEnd: "#5a3e18",
    tag: "FEATURE",
    imageUrl: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=80",
  },
  {
    id: 12,
    title: "The New Wave of Artists Refusing to Explain Their Work",
    summary: "A generation of musicians, directors, and visual artists are pulling back from press cycles and social media explanation — and the work is better for it.",
    content: `There's a growing cohort of artists — across music, film, and visual art — who have quietly stopped explaining themselves. No press junkets. Minimal social media. When they do speak, it's rarely about the work itself.\n\nThis is a deliberate counter-move to the context economy, in which every creative output arrives pre-chewed: the making-of documentary, the behind-the-scenes reel, the artist explaining what it means before you've had a chance to decide what it means to you.\n\nThe results, critically at least, have been notable. Work that arrives without a frame tends to generate richer, longer-lasting conversation. Absence of explanation is its own kind of invitation.\n\nFor the culture industry, this creates a real tension. Platforms are built for context and explanation. Algorithms reward the parasocial. Artists who opt out are making a choice with real commercial consequences — and making it anyway.`,
    keyPoints: ["Artists across disciplines withdrawing from press and social explanation", "Counter-move against the 'context economy' of pre-explained art", "Critics and audiences generating richer responses to unexplained work", "Commercial consequences real — artists opting out anyway"],
    impact: "The most interesting thing you can do with your art right now might be to shut up about it.",
    signalScore: 60,
    category: "Culture",
    source: "NME",
    readTimeMinutes: 4,
    publishedAt: dateAt(3, 17),
    likes: 3940,
    isBookmarked: false,
    gradientStart: "#1a1208",
    gradientEnd: "#5a3e18",
    tag: "HOT TAKE",
    imageUrl: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800&q=80",
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

  const attempt = (n: number) => {
    loadLiveArticles()
      .then((articles) => {
        const prevById = new Map(liveArticles.map((a) => [a.id, a]));
        liveArticles = (articles as ArticleRecord[]).map((a) => {
          const prev = prevById.get(a.id);
          return prev ? { ...a, likes: prev.likes, isBookmarked: prev.isBookmarked } : { ...a };
        });
        isLive = true;
        console.log(`[api] ✓ Switched to ${liveArticles.length} live RSS articles.`);
      })
      .catch((err: Error) => {
        const cause = (err as any).cause;
        console.error(`[api] RSS refresh failed (attempt ${n}): ${err.message}${cause ? ` | cause: ${cause.message ?? cause}` : ""}`);
        if (n < 3) {
          const delay = n * 8000;
          console.log(`[api] Retrying in ${delay / 1000}s…`);
          setTimeout(() => attempt(n + 1), delay);
        } else {
          console.error("[api] All retries exhausted — keeping static articles.");
        }
      });
  };

  // Small delay so Vite finishes initialising before the first outbound request
  setTimeout(() => attempt(1), 1500);
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
