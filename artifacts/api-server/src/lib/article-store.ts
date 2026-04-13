/**
 * In-memory article store for the API Server.
 *
 * Starts with a static fallback dataset. When ANTHROPIC_API_KEY is present,
 * kicks off the RSS+Claude enrichment pipeline in the background and switches
 * to the curated daily feed once the first run completes.
 *
 * Refresh cadence: every 3 hours. Each run fetches the last 24h of articles,
 * merges new qualifying stories into the day's curated feed, and persists to
 * disk via curated-store.
 */
import {
  loadLiveArticles,
  generateShortlist,
  loadShortlist,
  enrichSelectedItems,
  type EnrichedArticle,
  type ShortlistCandidate,
  type RawRSSItem,
} from "./rss-enricher.js";
import {
  loadFromSupabase,
  loadDailyFeed,
  mergeFeed,
  saveDailyFeed,
  saveCommittedFeed,
  loadCommittedFeeds,
  getPublishedFeed,
  getPublishedRefs,
  getAllPublishedRefs,
  resetIfNewDay,
  resetTodayFeed,
  removeArticles,
  updateArticleImage,
} from "./curated-store.js";

// ─── Static fallback dataset ──────────────────────────────────────────────────

function dateAt(hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const STATIC_ARTICLES: EnrichedArticle[] = [
  {
    id: 1,
    title: "The Album That Just Broke Every Streaming Record",
    summary: "A surprise drop from one of music's biggest names has shattered first-week streaming records.",
    content: "Nobody saw it coming. A midnight drop, zero singles, zero promo cycle — just 17 tracks and a cover image that immediately became a meme.\n\nWhat's remarkable isn't just the numbers. It's what this release strategy signals about where the music industry's power has shifted.\n\nThe surprise album is becoming the prestige format of choice for artists who have enough pull to dispense with the machine entirely.",
    keyPoints: ["First-week streams broke platform records", "Zero traditional promo cycle", "Cover art became a viral meme within hours"],
    signalScore: 91,
    category: "Music",
    source: "Pitchfork",
    readTimeMinutes: 4,
    publishedAt: dateAt(9),
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
    summary: "A polarising auteur returns with a three-hour provocation that Cannes either loved or walked out of.",
    content: "Cannes has always been a place where films are made into events, and this year's most talked-about entry arrived with exactly the kind of baggage the festival thrives on.\n\nThe film is dense, demanding, and at times genuinely difficult to watch. It is also the most formally ambitious work its director has produced.\n\nThe discourse is the first act. The actual film is what comes after.",
    keyPoints: ["Standing ovation at Cannes despite mid-screening walkouts", "Three-hour runtime sparks debate", "Wide release scheduled for late summer"],
    signalScore: 78,
    category: "Film & TV",
    source: "Variety",
    readTimeMinutes: 4,
    publishedAt: dateAt(11),
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
    summary: "A long-awaited sequel shipped to record sales and immediate controversy.",
    content: "Day one of a major release used to mean launch parties and review scores. Now it means watching the speedrun community dismantle your carefully crafted world in real time.\n\nThe exploit was documented, replicated, and posted to YouTube within six hours of launch.\n\nThe game has landed — whatever you think of the exploit.",
    keyPoints: ["Record-breaking launch sales", "Gamebreaking exploit found within 6 hours", "Developer evaluating a patch"],
    signalScore: 82,
    category: "Gaming",
    source: "IGN",
    readTimeMinutes: 4,
    publishedAt: dateAt(14),
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
    summary: "From fast food to luxury fashion, a visual homogenisation is creeping across global branding.",
    content: "Look at any brand refresh from the past three years and you'll notice something: they're all starting to look like each other.\n\nThis isn't a coincidence — it's the output of the same few consultancies and the same AI-assisted mood-boarding tools applied to every brief.\n\nWhen every brand tries to look authentic, nothing does.",
    keyPoints: ["Brand redesigns converging on a shared aesthetic", "Same consultancies producing similar outputs", "Luxury fashion moving toward generic quiet aesthetics"],
    signalScore: 65,
    category: "Fashion",
    source: "Dazed",
    readTimeMinutes: 4,
    publishedAt: dateAt(8),
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
    summary: "A mid-season pickup from a struggling streamer just became the most-talked-about drama on TV.",
    content: "Nobody had it on their radar. It wasn't adapted from IP. The showrunner wasn't a household name.\n\nWhat the show gets right is almost impossible to legislate for. The pacing is patient without being slow. The dialogue is sharp without showing off.\n\nThe question now is whether the platform knows what it has.",
    keyPoints: ["Unheralded pickup becoming the year's most discussed drama", "No IP, no traditional stars", "Second season pressure already being applied"],
    signalScore: 74,
    category: "Film & TV",
    source: "The Hollywood Reporter",
    readTimeMinutes: 4,
    publishedAt: dateAt(12),
    likes: 5830,
    isBookmarked: false,
    gradientStart: "#0e1a2e",
    gradientEnd: "#2a3f6a",
    tag: "REVIEW",
    imageUrl: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800&q=80",
  },
];

// ─── Live state ───────────────────────────────────────────────────────────────

let _isLive = false;

export function getArticles(): EnrichedArticle[] {
  resetIfNewDay();
  const feed = getPublishedFeed();
  if (feed.length > 0) return feed;
  return STATIC_ARTICLES.map((a) => ({ ...a }));
}

export function getIsLive(): boolean {
  return _isLive;
}

export function markLive(): void {
  _isLive = true;
}

export function updateLike(id: number): EnrichedArticle | null {
  const articles = getArticles();
  const article = articles.find((a) => a.id === id);
  if (!article) return null;
  article.likes += 1;
  return article;
}

export function toggleBookmark(id: number): EnrichedArticle | null {
  const articles = getArticles();
  const article = articles.find((a) => a.id === id);
  if (!article) return null;
  article.isBookmarked = !article.isBookmarked;
  return article;
}

export function getArticleById(id: number): EnrichedArticle | null {
  return getArticles().find((a) => a.id === id) ?? null;
}

export function deleteArticles(ids: number[]): number {
  return removeArticles(ids);
}

export async function updateArticleImageById(
  id: number,
  imageUrl: string,
): Promise<EnrichedArticle | null> {
  // Fetch dimensions for the new URL so the frontend can layout correctly
  let width: number | undefined;
  let height: number | undefined;
  try {
    const { fetchImageDimensions } = await import("./rss-enricher.js");
    const dims = await fetchImageDimensions(imageUrl);
    if (dims) { width = dims.width; height = dims.height; }
  } catch { /* dimensions are optional — proceed without */ }
  return updateArticleImage(id, imageUrl, width, height);
}

// ─── Enrichment + recurring refresh ──────────────────────────────────────────

const REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours

let _refreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleNextRefresh(): void {
  if (process.env.DISABLE_AUTO_REFRESH === "1") {
    console.log("[api] DISABLE_AUTO_REFRESH set — skipping scheduled refresh. Use POST /api/refresh to run manually.");
    return;
  }
  if (_refreshTimer) clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(() => {
    console.log("[api] ⏰ 3-hour refresh triggered — starting curation run…");
    runCurationCycle(1);
  }, REFRESH_INTERVAL_MS);
}

function runCurationCycle(attempt: number, windowStart?: Date, publishToday = false, windowEnd?: Date): void {
  // Use full historical refs so stories already covered on previous days are excluded
  const alreadyPublished = getAllPublishedRefs();
  console.log(
    `[api] Curation run (attempt ${attempt}) — ${alreadyPublished.length} stories already in today's feed.`
  );

  loadLiveArticles(alreadyPublished, windowStart, publishToday, windowEnd)
    .then((enriched) => {
      const added = mergeFeed(enriched);
      saveCommittedFeed();
      _isLive = true;
      const total = getPublishedFeed().length;
      console.log(`[api] ✓ Curation run complete — +${added} new stories (${total} total in today's feed).`);
      // Schedule next run in 3 hours
      scheduleNextRefresh();
    })
    .catch((err: Error) => {
      const cause = (err as any).cause;
      console.error(
        `[api] Curation run failed (attempt ${attempt}): ${err.message}${cause ? ` | cause: ${cause.message ?? cause}` : ""}`
      );
      if (attempt < 3) {
        const delay = attempt * 8_000;
        console.log(`[api] Retrying in ${delay / 1000}s…`);
        setTimeout(() => runCurationCycle(attempt + 1, windowStart, publishToday, windowEnd), delay);
      } else {
        console.error("[api] All retries exhausted — keeping current feed. Will retry at next 3h window.");
        scheduleNextRefresh();
      }
    });
}

/**
 * Kick off the curation pipeline immediately (e.g. from POST /api/refresh).
 * Safe to call at any time — resets the 3h timer after the run completes.
 *
 * @param windowStart  Optional earliest publish date to include from RSS feeds.
 *                     If omitted, defaults to the last 25 hours.
 * @param publishToday If true, all enriched articles get today's date as
 *                     publishedAt regardless of their original RSS pub date.
 *                     Use when pulling a wider window so yesterday's articles
 *                     still appear in today's section of the feed.
 */
export function triggerRefresh(windowStart?: Date, publishToday = false, windowEnd?: Date): void {
  console.log("[api] Manual refresh triggered.");
  if (_refreshTimer) {
    clearTimeout(_refreshTimer);
    _refreshTimer = null;
  }
  runCurationCycle(1, windowStart, publishToday, windowEnd);
}

// ─── New shortlist + publish workflow ─────────────────────────────────────────

let _shortlistRunning = false;

/**
 * Generate today's shortlist of ~50 ranked candidates without calling Claude.
 * Saves to /tmp/popcorn-shortlist-YYYY-MM-DD.json for publish to reference.
 */
export async function triggerShortlist(
  windowStart?: Date,
  windowEnd?: Date,
  customFeeds?: [string, string][],
): Promise<ShortlistCandidate[]> {
  if (_shortlistRunning) throw new Error("Shortlist generation already in progress");
  _shortlistRunning = true;
  try {
    const alreadyPublished = getPublishedRefs();
    const candidates = await generateShortlist(alreadyPublished, windowStart, windowEnd, customFeeds);
    return candidates;
  } finally {
    _shortlistRunning = false;
  }
}

/**
 * Enrich and publish the user-selected articles from today's shortlist.
 * @param indices  1-based shortlist indices (e.g. [3, 7, 12, 19])
 */
export async function publishSelected(indices: number[]): Promise<number> {
  const shortlist = loadShortlist();
  if (!shortlist) throw new Error("No shortlist found for today — run /api/shortlist first");

  const selected = indices
    .map((i) => shortlist.find((c) => c.index === i))
    .filter((c): c is ShortlistCandidate => c !== undefined);

  if (selected.length === 0) throw new Error("None of the provided indices matched the shortlist");

  const rawItems = selected.map((c) => c._raw);
  const enriched = await enrichSelectedItems(rawItems);
  const added = mergeFeed(enriched);
  saveCommittedFeed();
  _isLive = true;
  return added;
}

/**
 * Reset today's feed and publish a list of raw RSS items directly.
 * Used when the user selects from the full unfiltered RSS pull (not the shortlist).
 */
export async function publishRawItems(items: RawRSSItem[], reset: boolean, publishToday = false): Promise<number> {
  if (reset) resetTodayFeed();
  const enriched = await enrichSelectedItems(items, publishToday);
  const added = mergeFeed(enriched);
  saveCommittedFeed();
  _isLive = true;
  return added;
}

/**
 * Start the curation system on server boot.
 * Loads the persisted feed from Supabase (falling back to local files),
 * then immediately starts a curation run.
 */
export async function startEnrichment(): Promise<void> {
  // Load from Supabase (or local files as fallback)
  await loadFromSupabase();

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("[api] No ANTHROPIC_API_KEY — serving static articles.");
    if (getPublishedFeed().length > 0) _isLive = true;
    return;
  }

  console.log("[api] ANTHROPIC_API_KEY detected — starting curation pipeline…");

  // If we already have articles, mark as live immediately
  if (getPublishedFeed().length > 0) {
    _isLive = true;
    console.log(`[api] ✓ Restored ${getPublishedFeed().length} articles from saved feed.`);
  }

  // Skip the initial curation run if SKIP_INITIAL_RUN=1
  if (process.env.SKIP_INITIAL_RUN === "1") {
    console.log("[api] SKIP_INITIAL_RUN set — skipping initial curation run.");
    scheduleNextRefresh();
    return;
  }

  // Start first curation run after a short delay (let server finish booting)
  setTimeout(() => runCurationCycle(1), 1_500);
}
