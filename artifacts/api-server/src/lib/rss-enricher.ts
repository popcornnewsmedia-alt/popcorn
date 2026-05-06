/**
 * RSS Enricher — fetches live pop culture news from RSS feeds and enriches each article
 * with Claude to generate summaries, key points, signal scores, etc.
 *
 * Cache: writes to /tmp/bref-articles-YYYY-MM-DD.json so Claude is only
 * called once per day (per machine restart).
 */

import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { supabase } from "./supabase-client.js";
import { buildRefreshPrompt } from "./curation-prompt.js";

// ─── Image pool ────────────────────────────────────────────────────────────
// Curated Unsplash photos that work well as article hero images.
// Claude picks an index from this list for each article.
// Category-matched fallback images — used only when a real image cannot be found
const CATEGORY_FALLBACK_IMAGES: Record<string, string[]> = {
  "Music": [
    "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=2400&q=92", // concert crowd
    "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=2400&q=92", // festival stage
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=2400&q=92", // microphone
    "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=2400&q=92", // recording studio
    "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=2400&q=92", // DJ / nightlife
  ],
  "Film & TV": [
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=2400&q=92", // movie theater
    "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=2400&q=92", // film camera
    "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=2400&q=92", // retro TV
    "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=2400&q=92", // streaming glow
  ],
  "Gaming": [
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=2400&q=92", // gaming setup
    "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=2400&q=92", // controller
    "https://images.unsplash.com/photo-1518972734183-cc86ec78ee26?w=2400&q=92", // neon lights
  ],
  "Fashion": [
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=2400&q=92", // runway
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=2400&q=92", // sneakers
    "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=2400&q=92", // editorial
  ],
  "Internet": [
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=2400&q=92", // people on phones / social scrolling
    "https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=2400&q=92", // scrolling screen
    "https://images.unsplash.com/photo-1534972195531-d756b9bfa9f2?w=2400&q=92", // neon city night
    "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=2400&q=92", // crowd / viral energy
  ],
  "Sports": [
    "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=2400&q=92", // soccer ball
    "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=2400&q=92", // football match action
    "https://images.unsplash.com/photo-1540747913346-19212a4f5f57?w=2400&q=92", // stadium crowd
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=2400&q=92", // pitch aerial
  ],
  "Tech": [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=2400&q=92", // circuit board
    "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=2400&q=92", // laptop dark
    "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=2400&q=92", // device glow
  ],
  "AI": [
    "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=2400&q=92", // neural abstract
    "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=2400&q=92", // robot/AI face
    "https://images.unsplash.com/photo-1507146153580-69a1fe6d8aa1?w=2400&q=92", // data streams
  ],
  "Culture": [
    "https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=2400&q=92", // art gallery
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=2400&q=92", // editorial
    "https://images.unsplash.com/photo-1531058020387-3be344556be6?w=2400&q=92", // crowd at event
  ],
  "World": [
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=2400&q=92", // earth from space
    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=2400&q=92", // city aerial
    "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=2400&q=92", // globe map
  ],
  "Industry": [
    "https://images.unsplash.com/photo-1444653614773-995cb1ef9efa?w=2400&q=92", // office/business
    "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=2400&q=92", // suited exec
    "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?w=2400&q=92", // deal/handshake
  ],
  "Books": [
    "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=2400&q=92", // library shelves
    "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=2400&q=92", // open book
    "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=2400&q=92", // bookshelf warm
  ],
  "Science": [
    "https://images.unsplash.com/photo-1532094349884-543559872441?w=2400&q=92", // lab/microscope
    "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=2400&q=92", // space/stars
    "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=2400&q=92", // moon close
  ],
};

// Flat pool kept for legacy reference
const IMAGE_POOL = Object.values(CATEGORY_FALLBACK_IMAGES).flat();

function fallbackImage(category: string, seed: number): string {
  const pool = CATEGORY_FALLBACK_IMAGES[category] ?? CATEGORY_FALLBACK_IMAGES["Internet"];
  return pool[seed % pool.length];
}

const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  "Film & TV": ["#0e1a2e", "#2a3f6a"],  // deep navy blue
  Music:       ["#1a0e2e", "#4a2a6a"],  // dark purple
  Gaming:      ["#0a1e14", "#1e5a38"],  // dark forest green
  Fashion:     ["#1e0a12", "#6a1e36"],  // dark crimson/rose
  Internet:    ["#080e24", "#0e2a5a"],  // midnight blue
  Sports:      ["#200808", "#5a1818"],  // dark coral/red
  Tech:        ["#0d1520", "#1a3858"],  // steel blue
  AI:          ["#0a0818", "#260e52"],  // deep indigo/electric
  Culture:     ["#1a0c08", "#4a2010"],  // dark burnt sienna
  World:       ["#081018", "#103040"],  // dark teal-slate
  Industry:    ["#111114", "#28282e"],  // near-black charcoal
  Books:       ["#140e04", "#382210"],  // dark warm brown
  Science:     ["#041418", "#0a3038"],  // deep teal/cyan
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RawRSSItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: string;
  imageUrl?: string;
}

export interface ShortlistCandidate {
  index: number;          // 1-based — what you reply with to publish
  title: string;
  source: string;
  description: string;
  score: number;          // dedupScore — coverage × recency signal
  domain: SignalDomain;
  pubDate: string;
  link: string;
  imageUrl?: string;
  _raw: RawRSSItem;       // full raw item kept for enrichment lookup
}

export interface EnrichedArticle {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: string;
  source: string;
  readTimeMinutes: number;
  publishedAt: string;
  likes: number;
  isBookmarked: boolean;
  gradientStart: string;
  gradientEnd: string;
  tag: string;
  /** Original RSS/source link for the article — stable across re-adds,
   *  used to preserve the original image when a previously-published
   *  article is re-selected. Persisted as `source_link` in Supabase. */
  link?: string | null;
  imageUrl?: string | null;
  /** The ORIGINAL third-party source URL the hero image was fetched from,
   *  preserved after the image is downloaded and re-uploaded to Supabase
   *  Storage. Persisted so we can re-process (backfill) the image at a
   *  higher quality target later without re-running enrichment. */
  sourceImageUrl?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  /** Human-readable attribution for the hero image (e.g. "Wikimedia Commons",
   *  "Variety", "The Verge"). Derived from the original source URL's host at
   *  image-processing time, so it survives the rewrite to Supabase Storage. */
  imageCredit?: string | null;
  /** Normalized focal point (0–1) of the main visual subject. */
  imageFocalX?: number | null;
  imageFocalY?: number | null;
  /**
   * Minimum normalized fraction (0–1) of the image width / height that must
   * stay visible to preserve the story. Used by the card renderer to decide
   * whether a cover-crop would sacrifice critical content (multi-subject
   * compositions, product shots, group photos) and should fall back to
   * contain-on-blurred-backdrop instead.
   */
  imageSafeW?: number | null;
  imageSafeH?: number | null;
  keyPoints?: string[] | null;
  signalScore?: number | null;
  wikiSearchQuery?: string;
}

// ─── Image selection engine ───────────────────────────────────────────────────

type ImageIntent =
  | "PERSON"
  | "FILM_TV"
  | "MUSIC_ARTIST"
  | "MUSIC_ALBUM"
  | "EVENT"
  | "PLACE"
  | "ABSTRACT";

interface ImageCandidate {
  url: string;
  source:
    | "rss"
    | "og"
    | "youtube"
    | "tmdb"
    | "spotify"
    | "itunes"
    | "wikipedia"
    | "unsplash"
    | "category_fallback";
  width?: number;
  height?: number;
  /** For YouTube candidates — the video title, used to detect trailer text overlays. */
  videoTitle?: string;
}

// ── Diversity tracker ─────────────────────────────────────────────────────────
// Tracks the last IMAGE_DIVERSITY_WINDOW selected image URLs so repeated images
// receive a scoring penalty and get displaced by fresher ones.

const _imageDiversityMap = new Map<string, number>(); // url → usage count
const _imageDiversityQueue: string[] = [];            // insertion-ordered ring, max 100
const IMAGE_DIVERSITY_WINDOW = 100;

function trackImageUrl(url: string | null | undefined): void {
  if (!url || url.startsWith("__NEEDS_OG__")) return;
  _imageDiversityMap.set(url, (_imageDiversityMap.get(url) ?? 0) + 1);
  _imageDiversityQueue.push(url);
  if (_imageDiversityQueue.length > IMAGE_DIVERSITY_WINDOW) {
    const evicted = _imageDiversityQueue.shift()!;
    const prev = _imageDiversityMap.get(evicted) ?? 1;
    if (prev <= 1) _imageDiversityMap.delete(evicted);
    else _imageDiversityMap.set(evicted, prev - 1);
  }
}

function getDiversityPenalty(url: string): number {
  const count = _imageDiversityMap.get(url) ?? 0;
  if (count <= 1) return 0;
  return (count - 1) * 30; // -30 per additional occurrence
}

// ── Specific-scene classifier (Option 4) ──────────────────────────────────────
// Returns true when the article is about a SPECIFIC event / incident / scene
// that only has meaning when you see THAT exact image. Returns false when
// the article is about a general subject (a person, band, album, show, etc.)
// where ANY high-quality representative image of that subject is acceptable.
//
// Rationale: for general subjects we can afford to be picky — fall through
// to TMDb / Spotify / editorial CDNs for the canonical high-res portrait.
// For specific scenes we MUST keep the story-specific image even if it's a
// bit lower quality (we'd rather show a slightly grainy "Waymo in a
// Whataburger drive-thru" than a pristine stock photo of a Waymo).
function needsSpecificScene(
  intent: ImageIntent,
  title: string,
  summary: string
): boolean {
  // General-subject intents are NEVER scene-specific by default
  if (intent === "PERSON" || intent === "MUSIC_ARTIST" || intent === "MUSIC_ALBUM" ||
      intent === "FILM_TV" || intent === "ABSTRACT") {
    // …unless the headline is clearly about an incident
    const incident = /\b(arrest|arrested|crash|crashed|collision|shoots?|shot|fire|fired at|explosion|protest|riot|collapse|injur(y|ed|ies)|stabbed|attack|raid|investigat|scandal|leaked|hack|breach|caught|filmed|video shows?|footage|goes wrong|went wrong|shut down|canceled|cancelled|evacuat)\b/i;
    return incident.test(`${title} ${summary}`);
  }

  // EVENT / PLACE intents — usually scene-specific
  // (a festival set, a ceremony, a venue, a specific moment)
  if (intent === "EVENT" || intent === "PLACE") return true;

  return false;
}

// ── Intent classifier ─────────────────────────────────────────────────────────
// Rule-based: no LLM. Category is the strongest signal; title + summary break ties.

function classifyImageIntent(
  category: string,
  title: string,
  summary: string
): ImageIntent {
  const text = `${title} ${summary}`.toLowerCase();

  if (category === "Film & TV") return "FILM_TV";

  if (category === "Music") {
    const albumSignals =
      /\b(album|ep|drops?|drop(ped)?|releas(e|es|ed)|track(s)?|song(s)?|single|lp|debut record)\b/;
    return albumSignals.test(text) ? "MUSIC_ALBUM" : "MUSIC_ARTIST";
  }

  // Person signals — apply across any category
  const personVerbs =
    /\b(dies?|dead|death|born|marr(y|ies|ied)|arrest(s|ed)?|sentenced|win(s|ning)?|names?|appointed|joins?|leaves?|quit(s|ting)?|fired|hired|retire(s|d)?|comeback|announces?\s+(tour|pregnancy|divorce|split|album)|draw(s|ing)?|headline(s|d)?|perform(s|ed|ing)?|star(s|red|ring)?|appear(s|ed|ing)?|attend(s|ed|ing)?|feature(s|d)?|host(s|ed|ing)?|open(s|ed|ing)?\s+(for|at))\b/;
  const personTitles =
    /\b(singer|rapper|actor|actress|director|musician|athlete|golfer|footballer|comedian|presenter|ceo|founder|author)\b/;
  if (personVerbs.test(text) || personTitles.test(text)) return "PERSON";

  // Event signals
  const eventSignals =
    /\b(award(s)?|grammy|oscar|bafta|emmy|vma|festival|concert|tour|premiere|launch|unveil(ed|s)?|ceremony|showcase|gala|summit|cannes|sundance|coachella)\b/;
  if (eventSignals.test(text)) return "EVENT";

  // Place signals
  const placeSignals =
    /\b(city|country|nation|region|museum|gallery|venue|stadium|arena|theater|theatre|landmark)\b/;
  if (placeSignals.test(text)) return "PLACE";

  // Abstract categories — these rarely have a useful human subject image
  const abstractCategories = new Set(["AI", "Tech", "Internet", "Industry", "Science", "Books"]);
  if (abstractCategories.has(category)) return "ABSTRACT";

  // Fallback: if the headline starts with what looks like a proper noun, treat as PERSON
  const hasProperNoun = /^[A-Z][a-z]+ [A-Z][a-z]+/.test(title);
  return hasProperNoun ? "PERSON" : "ABSTRACT";
}

// ── Candidate scorer ──────────────────────────────────────────────────────────

const SOURCE_BASE_SCORES: Record<ImageCandidate["source"], number> = {
  tmdb:              25,
  og:                20,
  youtube:           18,
  spotify:           15,
  wikipedia:         12,
  rss:               10,
  unsplash:          14,
  itunes:             8,
  category_fallback: -20,
};

// ── Editorial CDN boost (Option 6) ────────────────────────────────────────────
// URLs matching these patterns come from high-quality editorial publishers.
// They're almost always sharp, well-lit, correctly licensed, editorially
// appropriate. We give them a +20 score boost — big enough to push a
// well-sourced RSS or OG image above a generic Wikipedia portrait.
const EDITORIAL_URL_PATTERNS: RegExp[] = [
  // Wire services / agencies
  /gettyimages\.(com|co\.uk)/i,
  /reuters\.com/i,
  /apnews\.com/i,
  /media\.bloomberg\.com/i,
  /assets\.afp\.com/i,
  // Photography-forward editorial outlets
  /media\.(pitchfork|vogue|gq|wired|vanityfair|allure|glamour|self|architecturaldigest|cntraveler|bonappetit|newyorker|wmagazine|them|epicurious)\.com/i,
  /media\.(rollingstone|variety|thehollywoodreporter|ew|people|usmagazine|harpersbazaar|elle|marieclaire|interview)\.com/i,
  // Magazine CMS CDNs (WordPress and others)
  /variety\.com\/wp-content\/uploads/i,
  /consequence\.net\/wp-content\/uploads/i,
  /stereogum\.com\/wp-content\/uploads/i,
  /lede-admin\.stereogum\.com/i,
  /pitchfork\.com\/photos/i,
  /nme\.com\/wp-content\/uploads/i,
  /rollingstone\.com\/wp-content\/uploads/i,
  /theguardian\.com\/img/i,
  /i\.guim\.co\.uk/i,
  // Tech & editorial longform
  /platform\.theverge\.com\/wp-content\/uploads/i,
  /cdn\.vox-cdn\.com/i,
  /futurism\.com\/wp-content\/uploads/i,
  /techcrunch\.com\/wp-content\/uploads/i,
  /arstechnica\.com\/wp-content\/uploads/i,
  /wired\.com\/photos/i,
  /media\.wired\.com/i,
  // Tabloid photo desks (good editorial stock of celebrities)
  /pagesix\.com\/wp-content/i,
  /nypost\.com\/wp-content/i,
  /people\.com\/thmb/i,
  /media\.tmz\.com/i,
  // Business / news wire photo desks (host genuine agency wire photos)
  /i\.insider\.com/i,
  /i\.businessinsider\.com/i,
  /static\.independent\.co\.uk/i,
  /img\.semafor\.com/i,
  /d\.newsweek\.com/i,
  /static\.politico\.com/i,
  /assets\.nydailynews\.com/i,
  /images\.thedailybeast\.com/i,
  // Wikimedia commons (high-res portraits of public figures)
  /upload\.wikimedia\.org\/wikipedia\/commons/i,
  // US newspapers
  /static0?1?\.nyt\.com/i,
  /static\.nytimes\.com/i,
  /washingtonpost\.com\/wp-apps\/imrs/i,
  /wapo\.st/i,
  /cdn\.cnn\.com/i,
  /media\.cnn\.com/i,
  /media\.npr\.org/i,
  /s\.abcnews\.com/i,
  // UK
  /ichef\.bbci\.co\.uk/i,
  /assets\.bbc\.co\.uk/i,
  /i\.guim\.co\.uk/i,
  // Entertainment wire
  /media\.cnn\.com/i,
  /image\.cnbcfm\.com/i,
  // Sports
  /cdn\.nba\.com/i,
  /a\.espncdn\.com/i,
  /sportshub\.cbsistatic\.com/i,
  // Fashion
  /media\.hypebeast\.com/i,
  /image\.harpersbazaar\.com/i,
  /cdn\.highsnobiety\.com/i,
  // Music
  /media\.billboard\.com/i,
  /dailytrust-production\.s3\.amazonaws\.com/i,
];

function isEditorialUrl(url: string): boolean {
  return EDITORIAL_URL_PATTERNS.some((re) => re.test(url));
}

function scoreCandidate(
  c: ImageCandidate,
  intent: ImageIntent,
  isAlbumIntent: boolean,
  sceneSpecific: boolean
): number {
  let score = SOURCE_BASE_SCORES[c.source];

  const { width, height } = c;

  // Resolution bonus / penalty
  //
  // For scene-specific articles (incidents, events) the RSS image is often
  // a generic publicity portrait rather than a wire photo of the actual
  // scene. A real wire/agency photo is almost always ≥2000px wide. Anything
  // under 1500px is almost certainly a file photo and should be penalised
  // so YouTube news thumbnails / wire photo candidates can win.
  //
  // For non-scene-specific articles (portraits, general subjects) we lean
  // harder on absolute resolution — a pristine 2000px photo is much better
  // than a story-adjacent 900px one.
  if (width !== undefined) {
    if (sceneSpecific) {
      if      (width >= 2000) score += 20;  // real wire/agency photo
      else if (width >= 1500) score += 10;
      else if (width >= 1200) score +=  5;
      else                    score -= 10;  // probably stock portrait, not wire
    } else {
      if      (width >= 2000) score += 25;
      else if (width >= 1600) score += 20;
      else if (width >= 1200) score += 15;
      else if (width >= 1000) score +=  5;
      else if (width < 800)   score -= 25;  // stricter low-res penalty
      if      (width < 600)   score -= 15;  // extra hit for really small
    }
  }

  // Aspect ratio bonus / penalty
  if (width !== undefined && height !== undefined && height > 0) {
    const ratio = width / height;
    if      (ratio >= 1.3 && ratio <= 2.0) score += 10;  // ideal editorial
    else if (ratio < 0.5 || ratio > 2.5)   score -= 15;  // extreme strip / sliver

    // Artifact penalty: square-ish image on non-album content (album covers, logos)
    if (!isAlbumIntent && ratio >= 0.9 && ratio <= 1.1) score -= 15;
  }

  // Intent-alignment bonuses
  if (intent === "FILM_TV"       && c.source === "tmdb")      score += 20;
  if (intent === "MUSIC_ARTIST"  && c.source === "spotify")   score += 15;
  if (intent === "MUSIC_ARTIST"  && c.source === "tmdb")      score +=  8;
  if (intent === "MUSIC_ALBUM"   && c.source === "spotify")   score += 15;
  if (intent === "MUSIC_ALBUM"   && c.source === "itunes")    score +=  5;
  if (intent === "PERSON"        && c.source === "tmdb")      score += 24;  // boosted — curated API portraits beat blurry OG
  if (intent === "PERSON"        && c.source === "spotify")   score += 16;  // boosted
  if (intent === "PERSON"        && c.source === "wikipedia") score +=  6;  // demoted — Wikipedia is often stale
  // EVENT + youtube: bumped from +12 to +18. For event articles the only
  // source of actual event footage is usually a news clip on YouTube —
  // editorial RSS is almost always a stock portrait of the person, not
  // a photo of the event itself.
  if (intent === "EVENT"         && c.source === "youtube")   score += 18;

  // PERSON + unsplash: Unsplash returns consistently high-quality curated
  // portraits. For celebrity/person articles a crisp Unsplash portrait is
  // far better than a blurry OG press photo or low-res RSS thumbnail.
  // Boosted to +18 so it reliably beats non-editorial OG (18-8=10) and
  // competes with TMDb (15+24=39) and Spotify (15+16=31).
  if (intent === "PERSON" && !sceneSpecific && c.source === "unsplash") score += 18;
  // MUSIC_ARTIST + unsplash: for musicians not in Spotify DB, Unsplash
  // concert/portrait shots are the best fallback.
  if (intent === "MUSIC_ARTIST" && c.source === "unsplash") score += 12;

  // Editorial URL boost (Option 6) — applies to ANY source whose final URL
  // resolves to a top-tier editorial CDN. Stacks with source base scores so
  // an RSS image from variety.com scores higher than an RSS image from a
  // no-name publisher.
  if (isEditorialUrl(c.url)) score += 20;

  // Non-editorial OG penalty for PERSON/MUSIC_ARTIST — generic OG images are
  // often blurry headshots or social media crops. Editorial OG is still rewarded
  // via the bonus above, so this only hits low-quality OG sources.
  if ((intent === "PERSON" || intent === "MUSIC_ARTIST") && c.source === "og" && !isEditorialUrl(c.url)) score -= 8;

  // YouTube trailer / text-overlay penalty — thumbnails for "Official Trailer",
  // "Teaser", "Music Video" etc. contain large text overlays that look bad in
  // the feed. If the YouTube video title matches these patterns, penalise so
  // a clean TMDb poster or Unsplash portrait can win.
  if (c.source === "youtube" && c.videoTitle) {
    const trailerRe = /\b(official\s+)?trailer\b|\bteaser\b|\bofficial\s+video\b|\blyric\s+video\b|\bmusic\s+video\b|\bfull\s+movie\b|\bclip\b/i;
    if (trailerRe.test(c.videoTitle)) score -= 20;
  }

  // Diversity penalty
  score -= getDiversityPenalty(c.url);

  return Math.max(-50, Math.min(100, score));
}

// ── Source priority map ───────────────────────────────────────────────────────
// Determines which sources are attempted for each intent, and acts as a
// tiebreaker when two candidates have equal scores.
//
// Option 3: PERSON now queries TMDb (actors/directors) and Spotify (musicians)
// in addition to the legacy Wikipedia fallback. Both return high-res canonical
// portraits where Wikipedia often gives an old/low-quality commons upload.
const INTENT_SOURCE_ORDER: Record<ImageIntent, ImageCandidate["source"][]> = {
  PERSON:       ["rss", "og", "tmdb", "spotify", "wikipedia", "youtube", "unsplash"],
  FILM_TV:      ["rss", "og", "tmdb", "youtube", "wikipedia", "unsplash"],
  MUSIC_ARTIST: ["rss", "og", "spotify", "tmdb", "youtube", "wikipedia", "unsplash"],
  MUSIC_ALBUM:  ["rss", "og", "spotify", "itunes", "youtube", "wikipedia"],
  EVENT:        ["rss", "og", "youtube", "wikipedia", "unsplash"],
  PLACE:        ["rss", "og", "wikipedia", "unsplash"],
  ABSTRACT:     ["rss", "og", "unsplash", "category_fallback"],
};

// ── Focal-point + safe-box detector ───────────────────────────────────────────
// Uses Claude's vision API to return:
//   - (x, y): focal point of the main subject
//   - (safeW, safeH): the MINIMUM fraction of the image that must remain
//     visible to preserve the story
//
// Returns null on failure, in which case callers should fall back to centre
// with no safe-box hint (preserving legacy cover-crop behaviour).
//
// SAFETY: This function is additive. A null return always preserves the current
// centre-crop behaviour — it never breaks images that already look fine.

export async function detectImageFocalPoint(
  imageUrl: string,
  context?: { title?: string; summary?: string; category?: string }
): Promise<{ x: number; y: number; safeW: number; safeH: number } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !imageUrl || imageUrl.startsWith("__NEEDS_OG__")) return null;

  const contextLines: string[] = [];
  if (context?.title)    contextLines.push(`Article title: "${context.title}"`);
  if (context?.category) contextLines.push(`Category: ${context.category}`);
  if (context?.summary)  contextLines.push(`Summary: ${context.summary.slice(0, 240)}`);
  const contextBlock = contextLines.length > 0 ? contextLines.join("\n") + "\n\n" : "";

  const body = JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "url", url: imageUrl },
          },
          {
            type: "text",
            text:
              contextBlock +
              "This image is the hero background for the article above, shown full-bleed in a tall portrait mobile feed (~9:16 aspect). Return JSON with:\n\n" +
              '{"x": 0.50, "y": 0.40, "safeW": 0.30, "safeH": 0.55}\n\n' +
              "- x, y: focal point of the single most important element (0,0=top-left, 1,1=bottom-right).\n" +
              "- safeW, safeH: the MINIMUM fraction of image width/height that must remain visible to preserve the article's story.\n\n" +
              "HOW TO DECIDE THE SAFE BOX — look at the article context, then the image:\n\n" +
              "1. IS THE STORY ABOUT A SINGLE PERSON? (one celebrity, one artist, one CEO)\n" +
              "   → Use safeW 0.15–0.30, safeH 0.25–0.50. Only that person's face matters.\n" +
              "   The stage, microphone, band behind them, audience, concert lighting, office backdrop — ALL disposable.\n" +
              "   Example: 'Noah Kahan announces tour' with a concert photo → safeW 0.25 (just his face), offset focal to where he stands.\n\n" +
              "2. IS THE STORY ABOUT TWO+ PEOPLE WHO ALL MATTER?\n" +
              "   FIRST CHECK: are the subjects close together (within ~40% of image width) or far apart (opposite sides)?\n" +
              "   → CLOSE TOGETHER (group photo, duo standing next to each other, band shot):\n" +
              "     Use safeW 0.50–0.90 to span all faces. Example: '4-member group photo' → safeW 0.85.\n" +
              "   → FAR APART (split composition, subjects on opposite sides, composite/collage image):\n" +
              "     DO NOT try to capture both — it is impossible in a portrait crop. Instead, pick the PRIMARY subject\n" +
              "     (the person the story is most about, or the more recognisable face) and treat it as a single-person\n" +
              "     crop with safeW 0.15–0.30. The headline tells the reader who else is involved.\n" +
              "     Example: 'Trump attacks Pope Leo' with Trump on left, Pope on right → focus on Trump's face, safeW 0.25.\n" +
              "     Example: 'Ruby Rose accuses Katy Perry' with split image → focus on the more recognisable face, safeW 0.25.\n\n" +
              "3. IS THE STORY ABOUT A PRODUCT'S SHAPE OR DESIGN? (a shoe, a car, a poster, a book cover, a gadget)\n" +
              "   → Use safeW 0.70–0.90, safeH 0.55–0.85. You need to see the whole object.\n" +
              "   Example: 'Vans slip-on gets Chanel makeover' with a horizontal shoe shot → safeW 0.85 (need toe AND heel).\n" +
              "   Example: 'New iPhone unveiled' with the device on a table → safeW 0.75.\n\n" +
              "4. IS THE STORY ABOUT AN EVENT / SCENE / PLACE?\n" +
              "   → Use safeW 0.50–0.70, safeH 0.50–0.70. Preserve composition but crop edges.\n\n" +
              "5. ABSTRACT / ILLUSTRATION / LOGO?\n" +
              "   → Use safeW 0.50, safeH 0.60.\n\n" +
              "KEY RULES:\n" +
              "- If ONLY ONE FACE is visible and the article is about that person, safeW must be ≤ 0.30. No exceptions — the face is all that matters.\n" +
              "- If the article title mentions TWO OR MORE people by name AND they are close together in the image, safeW must be ≥ 0.50. But if they are on OPPOSITE SIDES of a wide image, pick the primary subject and use safeW ≤ 0.30.\n" +
              "- Default to the SMALLEST safe box that still tells the story. The front-end has a 10% tolerance buffer for borderline cases.\n" +
              "- Respond with ONLY the JSON object. No prose.",
          },
        ],
      },
    ],
  });

  try {
    const raw = await new Promise<string>((resolve, reject) => {
      const req = https.request(
        {
          hostname: "api.anthropic.com",
          path: "/v1/messages",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Length": Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
          res.on("end", () => {
            if ((res.statusCode ?? 0) >= 400) {
              reject(new Error(`focal ${res.statusCode}: ${data.slice(0, 200)}`));
            } else {
              try {
                const json = JSON.parse(data);
                const content = json?.content?.[0];
                resolve(content?.type === "text" ? content.text : "");
              } catch {
                reject(new Error("parse"));
              }
            }
          });
        }
      );
      req.setTimeout(20_000, () => req.destroy(new Error("focal timeout")));
      req.on("error", reject);
      req.write(body);
      req.end();
    });

    // Pull the first JSON object out of the response text. We allow it to be
    // fairly loose — just look for {...} containing all four keys.
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as {
      x?: unknown;
      y?: unknown;
      safeW?: unknown;
      safeH?: unknown;
    };

    const num = (v: unknown): number | null => {
      if (typeof v !== "number") return null;
      if (!Number.isFinite(v)) return null;
      return v;
    };

    const x = num(parsed.x);
    const y = num(parsed.y);
    let safeW = num(parsed.safeW);
    let safeH = num(parsed.safeH);
    if (x === null || y === null) return null;

    // safeW/safeH are optional — if missing, fall back to a "fits cover" default
    // so legacy behaviour is preserved.
    if (safeW === null) safeW = 0.3;
    if (safeH === null) safeH = 0.5;

    // Clamp into sane ranges. Floor safeW/safeH at 0.1 (no smaller than a dot)
    // and cap at 1.0 (can't be bigger than the image).
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const clampSafe = (v: number) => Math.min(1, Math.max(0.1, v));

    return {
      x:     clamp01(x),
      y:     clamp01(y),
      safeW: clampSafe(safeW),
      safeH: clampSafe(safeH),
    };
  } catch (err) {
    console.warn(`[focal] detection failed for ${imageUrl.slice(0, 60)}: ${(err as Error).message}`);
    return null;
  }
}

// ── selectBestImage ───────────────────────────────────────────────────────────
// Collects ALL candidate images from applicable sources in parallel,
// scores every candidate, and returns the highest-scoring image.

async function selectBestImage(
  article: EnrichedArticle,
  articleUrl: string,
  rssImageUrl: string | null,
  fallbackIdx: number
): Promise<{
  url: string;
  width?: number;
  height?: number;
  focalX?: number;
  focalY?: number;
  safeW?: number;
  safeH?: number;
  debug?: { intent: ImageIntent; sceneSpecific: boolean; top3: string; winnerSource: string };
}> {
  const wikiQuery = article.wikiSearchQuery ?? "";
  const intent = classifyImageIntent(
    article.category,
    article.title,
    article.summary ?? ""
  );
  const sceneSpecific = needsSpecificScene(intent, article.title, article.summary ?? "");
  const isAlbumIntent = intent === "MUSIC_ALBUM";
  const applicableSources = INTENT_SOURCE_ORDER[intent];

  // Quality gate parameters — portrait/general subjects get the strict bar
  // (short edge ≥ 1000px, ≥ 40 KB/MP). Scene-specific articles get a more
  // forgiving bar so we can keep the incident-specific image even if it's
  // slightly smaller / more compressed than the ideal.
  const qualityOpts = sceneSpecific
    ? { minShortEdge: 600, minBytesPerMP: 18_000 }
    : { minShortEdge: 1000, minBytesPerMP: 40_000 };

  // Person-aware quality gate for OG/RSS — even if the article is classified as
  // EVENT (person at a festival), we still want to reject blurry portrait OG
  // images. If the title leads with a person name or intent is PERSON/MUSIC_ARTIST,
  // enforce the strict portrait gate on OG images.
  const titleHasPerson = /^[A-Z][a-z]+ [A-Z][a-z]+/.test(article.title);
  const personQualityOpts = (titleHasPerson || intent === "PERSON" || intent === "MUSIC_ARTIST")
    ? { minShortEdge: 1000, minBytesPerMP: 40_000 }
    : qualityOpts;

  // ── Collect all candidates in parallel ──────────────────────────────────────
  let resolvedOgUrl: string | undefined;

  const fetchTasks: Promise<ImageCandidate | null>[] = [

    // 1. RSS image (already validated before this call; passed in directly).
    // We now ALSO fetch its dimensions so scoreCandidate can award the
    // resolution bonus — without this, a pristine 4000×2667 Variety photo
    // would score the same as a 600px thumbnail, losing to YouTube 1280×720.
    (async (): Promise<ImageCandidate | null> => {
      if (!rssImageUrl || !applicableSources.includes("rss")) return null;
      const dims = await fetchImageDimensions(rssImageUrl).catch(() => null);
      return {
        url:    rssImageUrl,
        source: "rss",
        width:  dims?.width,
        height: dims?.height,
      };
    })(),

    // 2. OG image — strict: quality + dims + isStrictOGValid
    (async (): Promise<ImageCandidate | null> => {
      if (!articleUrl || !applicableSources.includes("og")) return null;
      try { resolvedOgUrl = await fetchOGImage(articleUrl); } catch { return null; }
      if (!isGoodImageUrl(resolvedOgUrl)) return null;
      // Pixel-quality gate: rejects low-res and heavily-compressed images.
      // Uses personQualityOpts for person articles to block blurry portrait OG.
      const q = await isPixelQualityImage(resolvedOgUrl!, personQualityOpts);
      if (!q.pass) return null;
      if (!isStrictOGValid(resolvedOgUrl!, q.width && q.height ? { width: q.width, height: q.height } : null)) return null;
      return { url: resolvedOgUrl!, source: "og", width: q.width, height: q.height };
    })(),

    // 3. YouTube embedded thumbnail
    (async (): Promise<ImageCandidate | null> => {
      if (!articleUrl || !applicableSources.includes("youtube")) return null;
      try {
        const htmlRes = await fetch(articleUrl, {
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        if (!htmlRes.ok) return null;
        const videoId = extractYouTubeId(await htmlRes.text());
        if (!videoId) return null;
        const ytUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        // YouTube maxresdefault is 1280×720 — always allowed for scene-specific,
        // but blocked for portrait intents via the pixel gate's short-edge
        // requirement. We still call the gate so we reject 404 / placeholder.
        const q = await isPixelQualityImage(ytUrl, { minShortEdge: 640, minBytesPerMP: 15_000 });
        if (!q.pass) return null;
        return { url: ytUrl, source: "youtube", width: q.width, height: q.height };
      } catch { return null; }
    })(),

    // 4. YouTube active search (FILM_TV, MUSIC, EVENT — requires YOUTUBE_API_KEY)
    (async (): Promise<ImageCandidate | null> => {
      const ytKey = process.env.YOUTUBE_API_KEY;
      if (!ytKey || !wikiQuery || !applicableSources.includes("youtube")) return null;
      const activeIntents = new Set<ImageIntent>(["FILM_TV", "MUSIC_ARTIST", "MUSIC_ALBUM", "EVENT"]);
      if (!activeIntents.has(intent)) return null;
      try {
        const q = encodeURIComponent(`${wikiQuery} official trailer OR official video OR music video`);
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&maxResults=1&key=${ytKey}`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (!res.ok) return null;
        const data = await res.json() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        const item = data?.items?.[0];
        const videoId: string | undefined = item?.id?.videoId;
        if (!videoId) return null;
        const ytUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        const qr = await isPixelQualityImage(ytUrl, { minShortEdge: 640, minBytesPerMP: 15_000 });
        if (!qr.pass) return null;
        return { url: ytUrl, source: "youtube", width: qr.width, height: qr.height, videoTitle: item?.snippet?.title };
      } catch { return null; }
    })(),

    // 5. TMDb — Film & TV posters / person profiles (Option 3: now also PERSON)
    //    For FILM_TV, also tries a person-name fallback if the primary (film-title)
    //    search fails — e.g. "Jeremy Strong" when "The Social Network 2010 film"
    //    doesn't yield a usable result.
    (async (): Promise<ImageCandidate | null> => {
      if (!wikiQuery || !applicableSources.includes("tmdb")) return null;
      // TMDb movie posters are portrait-oriented (typically ~680-1000px wide).
      // The strict 1000px short-edge gate designed for person portraits rejects
      // most posters. Use a relaxed gate for FILM_TV so TMDb can compete.
      const tmdbQualityOpts = intent === "FILM_TV"
        ? { minShortEdge: 600, minBytesPerMP: 25_000 }
        : qualityOpts;
      let url = await fetchTMDbImage(wikiQuery);
      // FILM_TV fallback: if the primary search (film title) fails, try extracting
      // a person name from the headline and search TMDb for a portrait.
      if (!isGoodImageUrl(url) && intent === "FILM_TV") {
        const personMatch = article.title.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/);
        if (personMatch) {
          url = await fetchTMDbImage(personMatch[1]);
        }
      }
      if (!isGoodImageUrl(url)) return null;
      const q = await isPixelQualityImage(url!, tmdbQualityOpts);
      if (!q.pass) return null;
      return { url: url!, source: "tmdb", width: q.width, height: q.height };
    })(),

    // 6. Spotify — artist / album art (Option 3: now also PERSON)
    (async (): Promise<ImageCandidate | null> => {
      if (!wikiQuery || !applicableSources.includes("spotify")) return null;
      const url = await fetchSpotifyImage(wikiQuery);
      if (!isGoodImageUrl(url)) return null;
      // Spotify's largest image is 640×640 for artists — that's below our
      // strict portrait gate. Use a looser gate here (540 short-edge) so
      // the high-quality canonical artist image isn't rejected, but keep
      // the bytes-per-megapixel check so genuinely mushy thumbs still fail.
      const q = await isPixelQualityImage(url!, { minShortEdge: 540, minBytesPerMP: 30_000 });
      if (!q.pass) return null;
      return { url: url!, source: "spotify", width: q.width, height: q.height };
    })(),

    // 7. iTunes — album / artist art
    (async (): Promise<ImageCandidate | null> => {
      if (!wikiQuery || !applicableSources.includes("itunes")) return null;
      const url = await fetchItunesImage(wikiQuery);
      if (!isGoodImageUrl(url)) return null;
      const q = await isPixelQualityImage(url!, { minShortEdge: 1000, minBytesPerMP: 30_000 });
      if (!q.pass) return null;
      return { url: url!, source: "itunes", width: q.width, height: q.height };
    })(),

    // 8. Wikipedia — entity image (high trust for PERSON / FILM_TV / MUSIC)
    (async (): Promise<ImageCandidate | null> => {
      if (!wikiQuery || !applicableSources.includes("wikipedia")) return null;
      const url = await fetchWikipediaImage(wikiQuery);
      if (!isGoodImageUrl(url)) return null;
      // Wikipedia is often stale — enforce strict portrait gate here so we
      // only accept high-res commons uploads, never old 600px thumbnails.
      const q = await isPixelQualityImage(url!, qualityOpts);
      if (!q.pass) return null;
      // Network flakiness: isPixelQualityImage can return pass=true with
      // no dims when the 5s HEAD/Range request times out on slow Wikimedia
      // mirrors. Retry the dim fetch once directly to avoid dropping the
      // resolution bonus and losing to YouTube.
      let width  = q.width;
      let height = q.height;
      if (width === undefined || height === undefined) {
        const retry = await fetchImageDimensions(url!).catch(() => null);
        if (retry) { width = retry.width; height = retry.height; }
      }
      return { url: url!, source: "wikipedia", width, height };
    })(),

    // 9. Unsplash — controlled editorial fallback (not last resort)
    (async (): Promise<ImageCandidate | null> => {
      if (!wikiQuery || !applicableSources.includes("unsplash")) return null;
      const url = await fetchUnsplashImage(wikiQuery, article.category, intent);
      if (!isGoodImageUrl(url)) return null;
      const dims = await fetchImageDimensions(url!);
      return { url: url!, source: "unsplash", width: dims?.width, height: dims?.height };
    })(),
  ];

  const settled = await Promise.allSettled(fetchTasks);

  // Collect all non-null fulfilled results
  const rawCandidates: ImageCandidate[] = settled
    .filter((r): r is PromiseFulfilledResult<ImageCandidate | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((c): c is ImageCandidate => c !== null);

  // OG fallback: if strict OG validation failed but we have a raw URL, add as low-score candidate
  if (
    resolvedOgUrl &&
    isGoodImageUrl(resolvedOgUrl) &&
    !rawCandidates.find((c) => c.url === resolvedOgUrl)
  ) {
    rawCandidates.push({ url: resolvedOgUrl, source: "og" });
  }

  // Category fallback is always available as absolute last resort
  rawCandidates.push({
    url: fallbackImage(article.category, fallbackIdx),
    source: "category_fallback",
  });

  // ── Score every candidate ────────────────────────────────────────────────────
  const scored = rawCandidates.map((c) => ({
    ...c,
    score: scoreCandidate(c, intent, isAlbumIntent, sceneSpecific),
  }));

  // Sort by score descending; use source priority order as a tiebreaker
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ai = applicableSources.indexOf(a.source);
    const bi = applicableSources.indexOf(b.source);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  let winner = scored[0];

  // Portrait safety net: if the winner for a PERSON/MUSIC_ARTIST article is a
  // low-res non-editorial OG or RSS image, swap in the best TMDb/Spotify/Unsplash
  // or editorial runner-up. This catches edge cases where scoring alone doesn't
  // prevent a blurry portrait from winning (e.g. when no other candidates scored
  // high enough but a decent Unsplash/TMDb alternative exists).
  if ((intent === "PERSON" || intent === "MUSIC_ARTIST") && !sceneSpecific && winner.source !== "category_fallback") {
    const isLowQualityPortrait =
      (winner.source === "og" || winner.source === "rss") &&
      !isEditorialUrl(winner.url) &&
      (winner.width === undefined || winner.width < 1000);
    if (isLowQualityPortrait) {
      const betterAlt = scored.slice(1).find(c =>
        (c.source === "tmdb" || c.source === "spotify" || c.source === "unsplash" || isEditorialUrl(c.url)) &&
        c.width !== undefined && c.width >= 800
      );
      if (betterAlt) {
        console.log(`[img] Portrait safety net: ${winner.source}(${winner.score}) → ${betterAlt.source}(${betterAlt.score}) | ${article.title.slice(0, 40)}`);
        winner = betterAlt;
      }
    }
  }

  const diversityPenaltyApplied = getDiversityPenalty(winner.url) > 0;

  // Register winner in diversity tracker
  trackImageUrl(winner.url);

  // Debug log
  const top3 = scored.slice(0, 3).map((c) => `${c.source}(${c.score})`).join(" > ");
  const sceneTag = sceneSpecific ? " scene" : " portrait";
  console.log(
    `[img] ${intent}${sceneTag} | ${winner.source} score=${winner.score}${diversityPenaltyApplied ? " [diversity]" : ""} | ${top3} | ${article.title.slice(0, 40)}`
  );

  // ── Focal point + safe-box detection (best-effort, null-safe) ───────────────
  // Skip category_fallback images — they are generic stock photos where centre
  // is always correct. We only spend a vision call on "real" subject imagery.
  let focalX: number | undefined;
  let focalY: number | undefined;
  let safeW: number | undefined;
  let safeH: number | undefined;
  if (winner.source !== "category_fallback") {
    const focal = await detectImageFocalPoint(winner.url);
    if (focal) {
      focalX = focal.x;
      focalY = focal.y;
      safeW = focal.safeW;
      safeH = focal.safeH;
      console.log(
        `[focal] (${focal.x.toFixed(2)},${focal.y.toFixed(2)}) safe=(${focal.safeW.toFixed(2)}×${focal.safeH.toFixed(2)}) | ${article.title.slice(0, 40)}`
      );
    }
  }

  return {
    url: winner.url,
    width: winner.width,
    height: winner.height,
    focalX,
    focalY,
    safeW,
    safeH,
    debug: {
      intent,
      sceneSpecific,
      top3,
      winnerSource: winner.source,
    },
  };
}

// ── Public dry-run entry point ────────────────────────────────────────────────
// Exposes the image selection engine for offline/test use (scripts/dry-run-*)
// WITHOUT running the Vision focal-point detection (which is expensive and
// orthogonal to quality selection). Returns the same shape as selectBestImage.
//
// If `startingImageUrl` is provided, it's seeded into the candidate pool as
// an "rss" source — this mirrors how the real pipeline passes through the
// RSS imageUrl that was captured during feed parsing, so offline testing
// can give the existing image a fair shot against the new candidates.
export async function selectBestImageForDryRun(
  article: EnrichedArticle,
  articleUrl: string,
  startingImageUrl: string | null = null
): Promise<{
  url: string;
  width?: number;
  height?: number;
  debug?: { intent: ImageIntent; sceneSpecific: boolean; top3: string; winnerSource: string };
}> {
  // Temporarily disable focal detection by clearing the env var so the
  // detector short-circuits. Restore after so other callers in the same
  // process are unaffected.
  const prevKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "";
  try {
    const result = await selectBestImage(article, articleUrl, startingImageUrl, 0);
    return {
      url:    result.url,
      width:  result.width,
      height: result.height,
      debug:  result.debug,
    };
  } finally {
    if (prevKey !== undefined) process.env.ANTHROPIC_API_KEY = prevKey;
    else delete process.env.ANTHROPIC_API_KEY;
  }
}

// ── Public production entry point ─────────────────────────────────────────────
// Same as selectBestImageForDryRun but KEEPS focal-point detection enabled
// so the returned image has focal x/y and safe-area rectangles suitable for
// writing directly into Supabase (image_focal_x, image_focal_y, image_safe_w,
// image_safe_h).
export async function selectBestImageForRerun(
  article: EnrichedArticle,
  articleUrl: string,
  startingImageUrl: string | null = null
): Promise<{
  url: string;
  width?: number;
  height?: number;
  focalX?: number;
  focalY?: number;
  safeW?: number;
  safeH?: number;
  debug?: { intent: ImageIntent; sceneSpecific: boolean; top3: string; winnerSource: string };
}> {
  return await selectBestImage(article, articleUrl, startingImageUrl, 0);
}

// ─── XML helpers ─────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tag: string): string {
  // Handles CDATA and plain content
  const re = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`,
    "i"
  );
  const m = block.match(re);
  if (!m) return "";
  return stripHtml((m[1] ?? m[2] ?? "").trim());
}

function extractImage(block: string): string | undefined {
  // media:content url (most common in modern RSS — TMZ, Variety, etc.)
  const mc = block.match(/<media:content[^>]+url="([^"]+)"/i);
  if (mc && /\.(jpg|jpeg|png|webp|gif)/i.test(mc[1])) return mc[1];

  // media:thumbnail
  const mt = block.match(/<media:thumbnail[^>]+url="([^"]+)"/i);
  if (mt) return mt[1];

  // enclosure with image type
  const enc =
    block.match(/<enclosure[^>]+url="([^"]+)"[^>]+type="image/i) ||
    block.match(/<enclosure[^>]+type="image[^"]*"[^>]+url="([^"]+)"/i);
  if (enc) return enc[1];

  // <img src="..."> inside description/content
  const img = block.match(/<img[^>]+src="([^"]+)"/i);
  if (img && /^https?:\/\//.test(img[1])) return img[1];

  return undefined;
}

// Node's Date parser only handles GMT/UTC/Z and ±HH:MM offsets. Some feeds
// (notably Sky Sports) emit RFC-822 dates with legacy timezone abbreviations
// like "BST", which produce NaN and get silently dropped by downstream
// time-window filters. Swap the abbreviation for its numeric offset so the
// rest of the pipeline can parse it.
const RSS_TZ_OFFSETS: Record<string, string> = {
  BST: "+0100", // British Summer Time
  IST: "+0530", // India Standard Time
  AEST: "+1000",
  AEDT: "+1100",
  CET: "+0100",
  CEST: "+0200",
  EST: "-0500",
  EDT: "-0400",
  PST: "-0800",
  PDT: "-0700",
  CST: "-0600",
  CDT: "-0500",
  MST: "-0700",
  MDT: "-0600",
};
function normalizeRSSDate(raw: string): string {
  return raw.replace(/\b(BST|IST|AEST|AEDT|CET|CEST|EST|EDT|PST|PDT|CST|CDT|MST|MDT)\b/, (tz) => RSS_TZ_OFFSETS[tz]);
}

export function parseRSSItems(xml: string, source: string): RawRSSItem[] {
  const isAtom = /<feed[\s>]/i.test(xml);
  const pattern = isAtom
    ? /<entry>([\s\S]*?)<\/entry>/gi
    : /<item>([\s\S]*?)<\/item>/gi;

  const items: RawRSSItem[] = [];
  let m: RegExpExecArray | null;

  // Keep up to 40 items per feed. Fast publishers like Wired can post >12 items
  // per day, so a 12-item cap was silently dropping older-but-still-in-window
  // stories (e.g. an article 24h old gets pushed out of slot 12 by the time we
  // fetch). 40 comfortably covers a 36–48h window for any feed we currently use.
  while ((m = pattern.exec(xml)) !== null && items.length < 40) {
    const block = m[1];

    const title = extractTag(block, "title");
    if (!title || title.length < 5) continue;

    let description =
      extractTag(block, "description") ||
      extractTag(block, "summary") ||
      extractTag(block, "content\\:encoded") ||
      extractTag(block, "content");
    description = description.slice(0, 250);

    // Link
    let link = "";
    const linkM =
      block.match(/<link>([^<]+)<\/link>/) ||
      block.match(/<link[^>]+href="([^"]+)"/i);
    if (linkM) link = linkM[1].trim();

    // Date
    let pubDate = new Date().toISOString();
    const dateM =
      block.match(/<pubDate>([^<]+)<\/pubDate>/i) ||
      block.match(/<published>([^<]+)<\/published>/i) ||
      block.match(/<updated>([^<]+)<\/updated>/i);
    if (dateM) pubDate = normalizeRSSDate(dateM[1].trim());

    const imageUrl = extractImage(block);
    items.push({ title, description, link, pubDate, source, imageUrl });
  }

  return items;
}

// ─── Image fetchers ──────────────────────────────────────────────────────────

const BAD_IMAGE_PATTERNS = [
  /i\.imgur\.com/,           // generic imgur placeholders
  /1x1/,                     // tracking pixels
  /pixel\./,                 // tracking pixels
  /spacer\.gif/,             // spacer GIFs
  /placeholder/i,            // placeholder images
  /default[-_]?(image|img|thumb)/i,
  /pubads\.g\.doubleclick\.net/,  // ad server
  /googlesyndication\.com/,       // ad server
  /adserver\./i,                  // generic ad servers
  /\/ad\?/,                       // ad request URLs
  /[Gg][Ee][Nn][Ee][Rr][Ii][Cc]/,// generic / GENRIC share images
  /Social_Share/i,                // generic social share images
  // Branding / UI assets — never editorial
  /[/_-]logo[/_.\-?]/i,
  /[/_-]icon[/_.\-?]/i,
  /[/_-]sprite[/_.\-?]/i,
  /[/_-]avatar[/_.\-?]/i,
  /[/_-]banner[/_.\-?]/i,
  /\/thumbnail\//i,
  /[/_-]tracking[/_.\-?]/i,
  // Low-quality / heavily-compressed CDNs — always fall through to OG/Unsplash
  /s\.yimg\.com/,
  /i\.dailymail\.co\.uk/,
  /cdn\.images\.express\.co\.uk/,
  /img\.dealnews\.com/,
  /cdn\.clovetech\.com/,
];

/** True if the URL looks structurally valid and is not a known bad source. */
function isGoodImageUrl(url: string | undefined | null): boolean {
  if (!url || !url.startsWith("http")) return false;
  if (BAD_IMAGE_PATTERNS.some((p) => p.test(url))) return false;
  // Reject images with an explicitly tiny width param (e.g. ?w=50, ?width=140)
  try {
    const u = new URL(url);
    const w = parseInt(u.searchParams.get("w") ?? u.searchParams.get("width") ?? "0", 10);
    if (w > 0 && w < 400) return false;
  } catch { /* ignore malformed URLs */ }
  return true;
}

/**
 * HEAD-request quality check — rejects images that are provably tiny (<80 KB).
 * Returns true if the image passes (or if we can't determine size — benefit of doubt).
 * Uses a short timeout so it doesn't meaningfully slow enrichment.
 *
 * NOTE: This is the weak legacy gate. For strict selection, use
 * `isPixelQualityImage()` which also enforces a minimum pixel count and
 * rejects heavily-compressed images via a bytes-per-megapixel heuristic.
 */
async function isHighQualityImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const size = parseInt(res.headers.get("content-length") ?? "0", 10);
    // Only hard-reject when content-length is explicitly present and tiny.
    // Many CDNs omit it, so absence of the header is not a failure.
    if (size > 0 && size < 80_000) return false;
    return true;
  } catch {
    return true; // network error → don't penalise, let it through
  }
}

/**
 * Strict pixel-based quality gate (Option 8).
 * Instead of trusting `content-length` alone — which is often missing or
 * misleading — this gate combines:
 *
 *   1. Real pixel dimensions (parsed from the first ~64 KB of the file)
 *   2. `content-length` header (for size-per-megapixel compression check)
 *
 * Rules:
 *   - Minimum short-edge in pixels (configurable — default 800, 1000 for
 *     portrait/general subjects, 600 for "specific scene" where we're
 *     desperate for ANY correct image of that exact event).
 *   - Bytes-per-megapixel must exceed ~25 KB/MP for JPEGs. Below that the
 *     image is so heavily compressed it looks mushy even at high res.
 *     (Reference: a decent editorial JPEG at quality ~80 comes in around
 *     60–120 KB/MP. A thumbnail blown up to 1200×800 at quality 30 might
 *     be 18 KB/MP and look terrible.)
 *
 * Returns an object with the dimensions (if known) so the caller can use
 * them downstream without re-fetching.
 */
async function isPixelQualityImage(
  url: string,
  opts: { minShortEdge?: number; minBytesPerMP?: number } = {}
): Promise<{ pass: boolean; width?: number; height?: number; reason?: string }> {
  const minShortEdge  = opts.minShortEdge  ?? 800;
  const minBytesPerMP = opts.minBytesPerMP ?? 25_000;

  // 1. Pixel dimensions (real — not the URL ?w= hint)
  const dims = await fetchImageDimensions(url);

  // 2. Content-length from HEAD (cheap — runs in parallel with the dimension
  //    fetch via the shared connection on most hosts)
  let contentLength = 0;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      contentLength = parseInt(res.headers.get("content-length") ?? "0", 10);
    }
  } catch {
    /* ignore — missing headers are common */
  }

  if (!dims) {
    // Unknown format or failed fetch — fall back to content-length check.
    if (contentLength > 0 && contentLength < 80_000) {
      return { pass: false, reason: `no-dims size=${contentLength}` };
    }
    return { pass: true }; // benefit of the doubt when genuinely unknown
  }

  const { width, height } = dims;
  const shortEdge = Math.min(width, height);

  if (shortEdge < minShortEdge) {
    return { pass: false, width, height, reason: `short-edge=${shortEdge} < ${minShortEdge}` };
  }

  // Extreme aspect ratios sneak past the short-edge check (e.g. 2400×200 banners)
  if (!isValidAspectRatio(width, height)) {
    return { pass: false, width, height, reason: `bad-aspect=${(width / height).toFixed(2)}` };
  }

  // Compression check — only runs when both dimensions and content-length are known.
  if (contentLength > 0) {
    const megapixels   = (width * height) / 1_000_000;
    const bytesPerMP   = contentLength / Math.max(megapixels, 0.01);
    if (bytesPerMP < minBytesPerMP) {
      return {
        pass: false, width, height,
        reason: `compressed ${(bytesPerMP / 1000).toFixed(0)}KB/MP < ${(minBytesPerMP / 1000)}KB/MP`,
      };
    }
  }

  return { pass: true, width, height };
}

/**
 * Rejects extreme aspect ratios (letterbox banners, tall thin strips).
 * Valid range: 0.5–2.0 (ratio = width / height).
 * Portrait phone image 1080×1920 → 0.5625 ✓
 * Landscape 16:9 (1920×1080) → 1.78 ✓
 * Tracking strip 1200×60 → 20 ✗
 * Very tall thin 100×600 → 0.17 ✗
 */
/**
 * Backend rejection threshold for extreme aspect ratios.
 * Ratio < 0.4 = ultra-tall strip; ratio > 3.0 = ultra-wide tracking banner.
 * Both are always bad UX and should be discarded at enrichment time.
 */
function isValidAspectRatio(width: number, height: number): boolean {
  if (!width || !height) return true; // unknown — pass
  const ratio = width / height;
  return ratio > 0.4 && ratio < 3.0;
}

/**
 * Strict OG-image validator — applied only to scraped OG/Twitter images.
 * Rejects logos, icons, avatars, banners, ads; too-small or extreme-ratio images.
 */
function isStrictOGValid(url: string, dims: { width: number; height: number } | null): boolean {
  // Reject known branding/UI filenames
  if (/[/_-](logo|icon|avatar|banner|sprite|ads?)[/_.\-?]/i.test(url)) return false;
  if (!dims) return true; // can't determine — give benefit of the doubt
  const { width, height } = dims;
  if (width < 600) return false;           // too small to be editorial
  const ratio = width / height;
  if (ratio > 2.5 || ratio < 0.4) return false; // extreme strip or sliver
  return true;
}

/**
 * Fetch the first ~2 KB of an image and try to read its pixel dimensions.
 * Supports PNG (IHDR), JPEG (SOF markers), and WebP (VP8 / VP8L / VP8X).
 * Returns null if dimensions cannot be determined (caller should pass the image).
 */
export async function fetchImageDimensions(url: string): Promise<{ width: number; height: number } | null> {
  try {
    // 64KB is enough to reach the SOF marker in almost every JPEG — even ones
    // with large EXIF / ICC profiles. 2KB was too stingy and left many images
    // (especially ones saved from Photoshop / CMS uploads) without dimensions.
    //
    // Timeout: 10s. Wikimedia mirrors in particular can be slow for the first
    // range request on a cold cache, and 5s was timing out frequently for
    // large commons uploads — which then caused the scoring to lose the
    // resolution bonus and let a lower-quality YouTube thumbnail win.
    const res = await fetch(url, {
      headers: { Range: "bytes=0-65535" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok && res.status !== 206) return null;
    const buf = Buffer.from(await res.arrayBuffer());

    // PNG: magic bytes 89 50 4E 47 — width at offset 16, height at 20 (big-endian)
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      if (buf.length < 24) return null;
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }

    // JPEG: starts FF D8 — scan for any SOF marker (FF C0–FF CF, except
    // FF C4 DHT / FF C8 reserved / FF CC DAC which are not SOF).
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length - 8) {
        if (buf[i] !== 0xff) break;
        const marker = buf[i + 1];
        const segLen = buf.readUInt16BE(i + 2);
        const isSOF =
          marker >= 0xc0 && marker <= 0xcf &&
          marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isSOF) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + segLen;
      }
    }

    // WebP: RIFF????WEBP at bytes 0-11
    if (
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50   // WEBP
    ) {
      const chunk = buf.slice(12, 16).toString("ascii");

      // VP8 (lossy): key frame sync at offset 23, width/height at 26-29
      if (chunk === "VP8 " && buf.length >= 30) {
        if (buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) {
          const width  = buf.readUInt16LE(26) & 0x3fff;
          const height = buf.readUInt16LE(28) & 0x3fff;
          if (width > 0 && height > 0) return { width, height };
        }
      }

      // VP8L (lossless): 28-bit packed header at offset 21
      if (chunk === "VP8L" && buf.length >= 25) {
        if (buf[20] === 0x2f) {
          const bits = buf.readUInt32LE(21);
          const width  = (bits & 0x3fff) + 1;
          const height = ((bits >> 14) & 0x3fff) + 1;
          if (width > 0 && height > 0) return { width, height };
        }
      }

      // VP8X (extended / animated): canvas w-1 at 24-26, h-1 at 27-29 (24-bit LE)
      if (chunk === "VP8X" && buf.length >= 30) {
        const width  = (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1;
        const height = (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1;
        if (width > 0 && height > 0) return { width, height };
      }
    }

    return null; // AVIF / other — can't determine
  } catch {
    return null;
  }
}

async function fetchOGImage(articleUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(articleUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });
    if (!res.ok) return undefined;
    // Only read the first 20 KB — the <head> is always near the top
    const reader = res.body?.getReader();
    if (!reader) return undefined;
    let html = "";
    while (html.length < 20000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
    }
    reader.cancel();
    // og:image
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch?.[1]?.startsWith("http")) return ogMatch[1];
    // twitter:image as fallback
    const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (twMatch?.[1]?.startsWith("http")) return twMatch[1];
    return undefined;
  } catch {
    return undefined;
  }
}

// iTunes Search API (free, no key) — returns album/artist artwork at up to 600×600.
// Best for Music articles: searches album art first, then falls back to artist image.
async function fetchItunesImage(query: string): Promise<string | undefined> {
  if (!query?.trim()) return undefined;
  try {
    // Try to find a specific album first
    const albumUrl =
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}` +
      `&entity=album&media=music&limit=1`;
    const albumRes = await fetch(albumUrl, { signal: AbortSignal.timeout(6000) });
    if (albumRes.ok) {
      const albumData = await albumRes.json();
      const art: string | undefined = albumData?.results?.[0]?.artworkUrl100;
      if (art) return art.replace("100x100bb", "3000x3000bb");
    }
    // Fall back to artist image
    const artistUrl =
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}` +
      `&entity=musicArtist&media=music&limit=1`;
    const artistRes = await fetch(artistUrl, { signal: AbortSignal.timeout(6000) });
    if (artistRes.ok) {
      const artistData = await artistRes.json();
      const art: string | undefined = artistData?.results?.[0]?.artworkUrl100;
      if (art) return art.replace("100x100bb", "3000x3000bb");
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// Visual context appended per category so Unsplash returns editorially relevant photos
// even when the raw wikiSearchQuery is a person name or niche topic.
const UNSPLASH_CATEGORY_HINT: Record<string, string> = {
  "Music":    "music concert stage performance",
  "Film & TV":"film cinema entertainment screen",
  "Gaming":   "gaming video games technology",
  "Fashion":  "fashion style clothing design",
  "Internet": "digital social media culture viral",
  "Tech":     "technology digital innovation device",
  "AI":       "artificial intelligence technology data",
  "Culture":  "culture art creative people",
  "World":    "city people travel international",
  "Industry": "business entertainment industry",
  "Books":    "books reading literature library",
  "Science":  "science research space discovery",
  "Sports":   "sport athlete competition",
};

// Search Unsplash for a keyword-relevant editorial photo.
// Combines 2–3 topic keywords with category-specific visual context words.
// When intent is PERSON or MUSIC_ARTIST, focuses on portrait-style results
// by appending "portrait" and dropping the category scenic hint.
async function fetchUnsplashImage(query: string, category?: string, intent?: ImageIntent): Promise<string | undefined> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !query?.trim()) return undefined;
  try {
    // Strip stopwords and take up to 3 topic signal words
    const topicWords = query
      .replace(/\b(the|a|an|and|or|of|in|on|at|to|for|with|is|are|was|were|has|have|had|be|been|being|that|this|these|those|it|its|gets?|says?|new|just|now|first|last|big|top|best|worst|how|why|what|when|who|will|can|may|more|most|all|one|two|three|its?|his|her|they|their|from|into|over|also|even|than|then|very|each|only)\b/gi, " ")
      .replace(/[^a-z0-9\s]/gi, " ")
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 3)
      .join(" ");

    // For PERSON/MUSIC_ARTIST intent: append "portrait" and skip the category
    // scenic hint to focus on headshots and editorial portraits rather than
    // generic concert crowds or scenic shots.
    const isPersonSearch = intent === "PERSON" || intent === "MUSIC_ARTIST";
    const hint = isPersonSearch
      ? "portrait"
      : (category ? (UNSPLASH_CATEGORY_HINT[category] ?? "") : "");
    const keywords = [topicWords, hint].filter(Boolean).join(" ").trim();
    if (!keywords) return undefined;

    // Portrait orientation for full-screen mobile cards; strict content filter; more candidates
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keywords)}&per_page=5&orientation=portrait&content_filter=high`;
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    const results: any[] = data?.results ?? [];
    for (const photo of results) {
      const src: string | undefined = photo?.urls?.full ?? photo?.urls?.regular;
      if (src?.startsWith("http")) return src;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// ─── Google Custom Search image fetcher ──────────────────────────────────────

/**
 * Strip to 2–3 strong signal nouns for Google Image queries.
 * Removes stopwords, filler journalism words, and noise.
 */
function cleanGoogleQuery(query: string): string {
  return query
    .replace(/\b(the|a|an|and|or|of|in|on|at|to|for|with|is|are|was|were|has|have|had|be|been|being|that|this|these|those|it|its|his|her|they|their|from|into|over|also|even|than|then|very|each|only|just|now|new|big|top|best|worst|first|last|one|two|three|more|most|all|any|no|not|so|but|if|as|by|up|out|about|after|before|says?|gets?|will|can|may|how|why|what|when|who|report|reveals?|breaking|latest|update|exclusive|source|news|confirms?|shows?)\b/gi, " ")
    .replace(/[^a-z0-9\s]/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 3)
    .join(" ");
}

/**
 * Extra URL-level filter for Google results — rejects branding/UI assets
 * that slip past the general BAD_IMAGE_PATTERNS check.
 */
function isGoodGoogleImage(url: string): boolean {
  if (!url?.startsWith("http")) return false;
  if (/\.(svg)(\?|$)/i.test(url)) return false;  // SVGs are almost always logos
  if (/[/_-](logo|icon|avatar|banner|sprite|ads?)([/_.\-?]|$)/i.test(url)) return false;
  if (/[/_-]thumbnail[/_.\-?]/i.test(url)) return false;
  // Reject tracking/redirect URLs (excessively long query strings)
  try {
    const u = new URL(url);
    if (u.search.length > 200) return false;
  } catch { return false; }
  return true;
}

/**
 * Fetch up to 5 Google Custom Search image results, validate each with
 * dimension + ratio + URL checks, score by area + aspect ratio, return best.
 * Requires GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX env vars.
 */
async function fetchBingImage(query: string): Promise<string | undefined> {
  const apiKey = process.env.BING_API_KEY;
  if (!apiKey || !query?.trim()) return undefined;
  try {
    const url = new URL("https://api.bing.microsoft.com/v7.0/images/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", "5");
    url.searchParams.set("imageType", "Photo");
    url.searchParams.set("size", "Large");
    url.searchParams.set("safeSearch", "Strict");
    const res = await fetch(url.toString(), {
      headers: { "Ocp-Apim-Subscription-Key": apiKey },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    const candidates: string[] = (data?.value ?? [])
      .map((item: any) => item?.contentUrl as string | undefined)
      .filter((u: string | undefined): u is string =>
        !!u && isGoodImageUrl(u) && !/\.(svg|gif)(\?|$)/i.test(u)
      );
    if (!candidates.length) return undefined;
    const scored = await Promise.all(
      candidates.map(async (u) => {
        const dims = await fetchImageDimensions(u);
        if (!dims) return { u, score: 0, valid: true };
        if (dims.width < 600) return { u, score: -1, valid: false };
        const r = dims.width / dims.height;
        if (r > 3 || r < 0.4) return { u, score: -1, valid: false };
        let score = dims.width * dims.height;
        if (r >= 0.7 && r <= 1.8) score += 500_000;
        if (r > 2.5) score -= 300_000;
        return { u, score, valid: true };
      })
    );
    const best = scored.filter(c => c.valid && c.score >= 0).sort((a, b) => b.score - a.score)[0];
    return best?.u;
  } catch { return undefined; }
}

async function fetchGoogleImage(query: string): Promise<string | undefined> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx     = process.env.GOOGLE_CSE_CX;
  if (!apiKey || !cx || !query?.trim()) return undefined;

  const q = cleanGoogleQuery(query);
  if (!q) return undefined;

  try {
    const searchUrl = new URL("https://www.googleapis.com/customsearch/v1");
    searchUrl.searchParams.set("q", q);
    searchUrl.searchParams.set("cx", cx);
    searchUrl.searchParams.set("key", apiKey);
    searchUrl.searchParams.set("searchType", "image");
    searchUrl.searchParams.set("num", "5");
    searchUrl.searchParams.set("imgSize", "large");
    searchUrl.searchParams.set("imgType", "photo");
    searchUrl.searchParams.set("safe", "active");

    const res = await fetch(searchUrl.toString(), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return undefined;

    const data = await res.json();
    const candidates: string[] = (data?.items ?? [])
      .map((item: any) => item?.link as string | undefined)
      .filter((url: string | undefined): url is string =>
        !!url && isGoodImageUrl(url) && isGoodGoogleImage(url)
      );

    if (candidates.length === 0) return undefined;

    // Validate + score all candidates in parallel
    const scored = await Promise.all(
      candidates.map(async (url) => {
        const dims = await fetchImageDimensions(url);
        if (!dims) return { url, score: 0, valid: true }; // unknown dims — allow, zero score
        const { width, height } = dims;
        if (width < 600) return { url, score: -1, valid: false };
        const ratio = width / height;
        if (ratio > 3 || ratio < 0.4) return { url, score: -1, valid: false };

        // Score: prefer large images with portrait-to-landscape ratios
        let score = width * height;
        if (ratio >= 0.7 && ratio <= 1.8) score += 500_000;  // ideal editorial ratio
        if (ratio > 2.5)                  score -= 300_000;  // penalise ultra-wide
        return { url, score, valid: true };
      })
    );

    const best = scored
      .filter(c => c.valid && c.score >= 0)
      .sort((a, b) => b.score - a.score)[0];

    return best?.url;
  } catch {
    return undefined;
  }
}

// Fetch the main image from a Wikipedia page that matches the search query.
// Uses a two-step Wikipedia API call — no API key required.
async function fetchWikipediaImage(query: string): Promise<string | undefined> {
  if (!query?.trim()) return undefined;
  try {
    // Step 1: find the best-matching Wikipedia page title
    const searchUrl =
      `https://en.wikipedia.org/w/api.php?action=query&list=search` +
      `&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=1`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });
    if (!searchRes.ok) return undefined;
    const searchData = await searchRes.json();
    const pageTitle: string | undefined = searchData?.query?.search?.[0]?.title;
    if (!pageTitle) return undefined;

    // Sanity check for person-focused queries (e.g. "Tiger Woods golfer"):
    // if the first name isn't in the returned page title, retry with just the name
    // (dropping the role word — e.g. "Tiger Woods golfer" → "Tiger Woods").
    const PERSON_ROLES = ["golfer","singer","rapper","actor","actress","musician","athlete","player","director","artist","comedian","presenter"];
    const isPersonQuery = PERSON_ROLES.some((r) => query.toLowerCase().includes(r));
    let resolvedTitle = pageTitle;
    if (isPersonQuery) {
      const firstName = query.split(/\s+/)[0].toLowerCase();
      if (!pageTitle.toLowerCase().includes(firstName)) {
        // Role word caused wrong result — retry with name only (strip role words)
        const nameOnly = query.split(/\s+/).filter((w) => !PERSON_ROLES.includes(w.toLowerCase())).join(" ");
        if (!nameOnly.trim()) return undefined;
        const retryRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(nameOnly)}&format=json&origin=*&srlimit=1`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (!retryRes.ok) return undefined;
        const retryData = await retryRes.json();
        const retryTitle: string | undefined = retryData?.query?.search?.[0]?.title;
        if (!retryTitle || !retryTitle.toLowerCase().includes(firstName)) return undefined;
        resolvedTitle = retryTitle;
      }
    }

    // Step 2: get the original/thumbnail image for that page
    const imgUrl =
      `https://en.wikipedia.org/w/api.php?action=query` +
      `&titles=${encodeURIComponent(resolvedTitle)}` +
      `&prop=pageimages&piprop=original|thumbnail&pithumbsize=1600` +
      `&format=json&origin=*`;
    const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(6000) });
    if (!imgRes.ok) return undefined;
    const imgData = await imgRes.json();
    const pages = Object.values(imgData?.query?.pages ?? {}) as any[];
    const src: string | undefined =
      pages[0]?.original?.source ?? pages[0]?.thumbnail?.source;
    // Skip SVG icons / logos / flags (bad hero images)
    if (src && src.startsWith("http") && !/\.svg$/i.test(src)) return src;
    return undefined;
  } catch {
    return undefined;
  }
}

// ─── YouTube ──────────────────────────────────────────────────────────────────
// Only used when the article HTML explicitly embeds a YouTube video.
// Never searches YouTube blindly — that would give irrelevant thumbnails.
function extractYouTubeId(html: string): string | null {
  const match =
    html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/) ||
    html.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/) ||
    html.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// ─── TMDb ─────────────────────────────────────────────────────────────────────
// The Movie Database — high-quality posters for Film & TV articles.
// Requires TMDB_API_KEY env var.
async function fetchTMDbImage(query: string): Promise<string | undefined> {
  const key = process.env.TMDB_API_KEY;
  if (!key || !query?.trim()) return undefined;
  try {
    const searchUrl =
      `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
    const res = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    const result = data?.results?.[0];
    // poster_path (movie/tv) or profile_path (person)
    const imagePath = result?.poster_path ?? result?.profile_path;
    if (!imagePath) return undefined;
    // Use original resolution
    return `https://image.tmdb.org/t/p/original${imagePath}`;
  } catch {
    return undefined;
  }
}

// ─── Spotify ──────────────────────────────────────────────────────────────────
// Spotify album/artist artwork — high-quality square art for Music articles.
// Requires SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET env vars.
// Uses Client Credentials flow with an in-memory token cache.
let _spotifyToken: string | null = null;
let _spotifyTokenExpiry = 0;

async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (_spotifyToken && Date.now() < _spotifyTokenExpiry) return _spotifyToken;
  try {
    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    _spotifyToken = data.access_token ?? null;
    _spotifyTokenExpiry = Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000;
    return _spotifyToken;
  } catch {
    return null;
  }
}

async function fetchSpotifyImage(query: string): Promise<string | undefined> {
  if (!query?.trim()) return undefined;
  const token = await getSpotifyToken();
  if (!token) return undefined;
  try {
    // Try album art first, then artist image
    for (const type of ["album", "artist"] as const) {
      const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=1`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const items = data?.[`${type}s`]?.items ?? [];
      const images: Array<{ url: string; width: number; height: number }> = items[0]?.images ?? [];
      // Pick the largest image (Spotify returns sorted largest→smallest)
      const src = images[0]?.url;
      if (src?.startsWith("http")) return src;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

export async function fetchFeed(
  url: string,
  sourceName: string
): Promise<RawRSSItem[]> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseRSSItems(xml, sourceName);
    console.log(`[rss] ${sourceName}: ${items.length} items`);
    return items;
  } catch (e) {
    console.warn(`[rss] ⚠ Failed to fetch ${sourceName} (${url}): ${e}`);
    return [];
  }
}

// ─── Deduplication + ranking ─────────────────────────────────────────────────

// High-signal keyword triggers — hints for the override layer to expand the candidate pool.
// Keywords are NOT gates. Claude makes the final inclusion decision based on cultural gravity.
const HIGH_SIGNAL_TRIGGERS = [
  // Dramatic events
  /\bfirst\b/i, /\breturns?\b/i, /\bshock(s|ed|ing)?\b/i, /\brecord\b/i, /\bhighest\b/i,
  /\bbans?\b/i, /\barrested?\b/i, /\bcancell?ed\b/i, /\bdies?\b/i, /\bdead\b/i,
  /\bcomeback\b/i, /\bbreakthrough\b/i, /\boutrage\b/i, /\bcontrovers/i,
  /\bscandal\b/i, /\bdisappear\b/i, /\breappear\b/i,
  /\$[\d,]{3,}/,                       // economic shock: price in thousands
  /\bworst\b.{0,30}\bever\b/i,         // superlatives
  /\bmost\b.{0,30}\bever\b/i,
  // Franchise / product lifecycle
  /\bdelay(s|ed|ing)?\b/i,
  /\bpostpon(e|ed|ing|ement)\b/i,
  /\bbroken\b/i,                       // broken records, broken promises
  /\bcancel(led?|ation)?\b/i,
  /\bleaked?\b/i,                      // franchise leaks
  /\btrailers?\b/i,                    // major property trailers
  // AI / cognition structural signals
  /\bemotion(s|al|ally)?\b/i,
  /\bcognition\b/i, /\bsentient\b/i, /\bconscious(ness)?\b/i,
  /\bautonomous?\b/i, /\bself.aware\b/i,
  /\bclaims?\b/i,
  // Viral / cultural momentum
  /\bviral\b/i, /\btrending\b/i,
  /\bmeltdown\b/i, /\bfeud\b/i,
];

// ─── Domain classification ────────────────────────────────────────────────────
// Every candidate item is tagged with a SignalDomain before the pool is built.
// This tag drives domain-balanced candidate selection and is shown to Claude
// in the article list so it can apply domain-aware editorial judgment.

type SignalDomain = 'AI_TECH' | 'ECONOMIC' | 'FANDOM' | 'INTERNET' | 'SPORTS' | 'CROSSDOMAIN' | 'ENTERTAINMENT';

// Source-level domain assignment (takes precedence over keyword detection)
const DOMAIN_BY_SOURCE: Partial<Record<string, SignalDomain>> = {
  "The Verge":        "AI_TECH",
  "TechCrunch":       "AI_TECH",
  "Wired":            "AI_TECH",
  "Futurism":         "AI_TECH",
  "ESPN":             "SPORTS",
  "Sky Sports":       "SPORTS",
  "Sky Sports Football": "SPORTS",
  "BBC Sport":        "SPORTS",
  "Know Your Meme":   "INTERNET",
  "Dexerto":          "INTERNET",
  "Semafor":          "CROSSDOMAIN",
  "The Atlantic":     "CROSSDOMAIN",
  "The New Yorker":   "CROSSDOMAIN",
  "Business Insider": "CROSSDOMAIN",
  "404 Media":        "CROSSDOMAIN",
  "Hypebeast":        "ECONOMIC",
  "Highsnobiety":     "ECONOMIC",
};

// Keyword-based domain detection — applied when source doesn't give a clear domain
const DOMAIN_KEYWORD_RULES: Array<[SignalDomain, RegExp[]]> = [
  ["AI_TECH", [
    /\bAI\b/, /artificial intelligence/i, /\bChatGPT\b/i, /\bOpenAI\b/i,
    /\bAnthropic\b/i, /\bGemini\b/i, /\bClaude\b.{0,20}\b(AI|model)\b/i,
    /\bLLM\b/, /\bmachine learning\b/i, /\bsentient\b/i, /\bautonomous?\b/i,
    /\bmodel\b.{0,20}\b(launch|update|release|emotion|think|feel)\b/i,
  ]],
  ["ECONOMIC", [
    /\$[\d,]+\s*billion/i, /\bwealth.{0,30}(drop|loss|lost|fell)\b/i,
    /\bstreaming record\b/i, /\bbox office record\b/i,
    /\bticket.{0,10}\$[\d,]{3,}/, /\$[\d,]{3,}.{0,10}ticket/i,
    /\brecord.{0,20}(revenue|sales|gross)\b/i, /\brichest\b/i,
  ]],
  ["FANDOM", [
    /\bchart.{0,20}(number one|#1|top)\b/i,
    /\bstreaming record\b/i, /\bworld record\b/i,
    /\bglobal.{0,20}chart\b/i, /\bfan.{0,20}(campaign|mob)\b/i,
    /\bnumber one.{0,20}(album|song|chart)\b/i,
  ]],
  ["INTERNET", [
    /\bviral\b/i, /\bTikTok\b/i, /\bmeme\b/i, /\btrending\b/i,
    /\bReddit\b/i, /\bX\.com\b/i,
  ]],
  ["CROSSDOMAIN", [
    /\b(president|congress|white house).{0,40}(music|film|sport|celebrity)\b/i,
    /\b(musician|artist|rapper|singer).{0,40}(sport|politics|tech)\b/i,
  ]],
];

function classifyDomain(item: RawRSSItem): SignalDomain {
  const sourceDomain = DOMAIN_BY_SOURCE[item.source];
  if (sourceDomain) return sourceDomain;
  const text = `${item.title} ${item.description ?? ""}`;
  for (const [domain, patterns] of DOMAIN_KEYWORD_RULES) {
    if (patterns.some((p) => p.test(text))) return domain;
  }
  return "ENTERTAINMENT";
}

// ─────────────────────────────────────────────────────────────────────────────

// Titles matching these patterns are junk that should never reach Claude
const JUNK_TITLE_PATTERNS = [
  /promo\s*code/i,
  /coupon/i,
  /\b\d+%\s*off\b/i,
  /\bdeal\s+(alert|of\s+the\s+day)\b/i,
  /\bwordle\b.{0,30}(answer|hint|today|solution)/i,
  /\bstrands\b.{0,30}(answer|hint|today|solution)/i,
  /\bconnections\b.{0,30}(answer|hint|today|solution)/i,
  /\bpuzzle\b.{0,30}(answer|hint|solution)/i,
  /\bwalkthrough\b/i,
  /\bhow\s+to\s+(beat|unlock|get|complete)\b/i,
  /\bbest\s+(laptops?|phones?|tvs?|monitors?|headphones?)\b/i,
  // Product roundups / gear listicles
  /\b\d+\s+(best|top|great|design.forward|worth\s+buying|must.have)\b/i,
  /\bworth\s+(upgrading|buying|trying)\b/i,
  /\bgear\s+(guide|roundup|picks?)\b/i,
  /\bbest\s+(tools?|gadgets?|apps?|products?|items?)\b/i,
  // Hard-blocked content — explicit/bait titles that must never reach Claude
  /\bdrop\s+(an?\s+)?f.?bomb\b/i,
  /\bf.?bomb\b.{0,40}(movie|film|trailer|show|scene|episode|clip)/i,
  // Gaming promo codes with month/year slug — "Doom by Fate codes (April 2026)"
  /\bcodes?\s*\((?:january|february|march|april|may|june|july|august|september|october|november|december)\s*\d{4}\)/i,
  /\bcodes?\s+\w{2,20}\s+\d{4}\b/i,   // "codes May 2026" etc.
  // Defense / military technology — never culturally consequential for Popcorn
  /\bhypersonic\s+(fighter|weapon|missile|combat|jet)\b/i,
  /\b(military|defense).grade\b/i,
  /\bautonomo\w+\s+hypersonic\b/i,
  // Geopolitical energy & commodity markets — out of Popcorn scope
  /\boil\b.{0,40}(approaches|climbs|deadline|nonlinear|pricing|barrel)\b/i,
  /\bgreen\s+hydrogen\b/i,
  /\bParis\s+Agreement\s+target\b/i,
  /\bArtemis\s+II\b.{0,40}head(s|ing)\s+back\b/i,  // duplicate Artemis pattern
];

const STOP_WORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being",
  "has","have","had","do","does","did","will","would","could","should","may","might",
  "and","or","but","if","as","at","by","for","in","of","on","to","up","from","with",
  "that","this","these","those","it","its","he","she","they","we","you","i",
  "his","her","their","our","your","my","new","say","says","said","just","now",
  "after","before","over","about","how","why","what","when","where","who","which",
  "more","one","two","three","first","last","top","big","make","get","see","go",
]);

function titleTokens(title: string): Set<string> {
  return new Set(
    title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

function jaccardSim(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

interface DedupeAuditEntry {
  item: RawRSSItem;
  /** Whether this item was sent to Claude, ranked out, or collapsed as a duplicate */
  status: "sent_to_claude" | "ranked_out" | "deduplicated";
  /** 1-based rank of this item's story group among all unique stories */
  rank: number;
  /** Dedup score for the group */
  score: number;
  /** For deduplicated items: the title of the representative that survived */
  groupedWith?: string;
  /** For deduplicated items: the source of the representative */
  groupedWithSource?: string;
}

/**
 * Deduplicate articles by title similarity, then rank by coverage × recency.
 * Returns the top `topN` unique story representatives plus a full audit of
 * every raw item (deduplicated, ranked-out, or sent-to-Claude).
 */
function deduplicateAndRank(
  items: RawRSSItem[],
  topN = 25
): { topN: RawRSSItem[]; allRanked: RawRSSItem[]; audit: DedupeAuditEntry[] } {
  type Group = {
    representative: RawRSSItem;
    members: RawRSSItem[];
    sourceCount: number;
    latestMs: number;
    tokens: Set<string>;
  };

  const groups: Group[] = [];

  for (const item of items) {
    const tokens = titleTokens(item.title);
    const dateMs = new Date(item.pubDate).getTime() || Date.now();

    let bestGroup: Group | null = null;
    let bestSim = 0.35; // minimum Jaccard threshold to be considered a duplicate

    for (const g of groups) {
      const sim = jaccardSim(tokens, g.tokens);
      if (sim > bestSim) {
        bestSim = sim;
        bestGroup = g;
      }
    }

    if (bestGroup) {
      bestGroup.members.push(item);
      bestGroup.sourceCount++;
      // Prefer the most recent version; break ties in favour of articles with images
      if (
        dateMs > bestGroup.latestMs ||
        (dateMs === bestGroup.latestMs &&
          item.imageUrl &&
          !bestGroup.representative.imageUrl)
      ) {
        bestGroup.latestMs = dateMs;
        bestGroup.representative = item;
      }
    } else {
      groups.push({ representative: item, members: [item], sourceCount: 1, latestMs: dateMs, tokens });
    }
  }

  // Score = log-scaled coverage + recency + high-signal boost.
  // Linear coverage weighting used to crush single-source but culturally loaded
  // stories (chess upsets, quirky arrests, lifestyle lists). Log scaling caps
  // the coverage advantage of pile-on stories; a high-signal keyword in the
  // title gives single-source stories a realistic shot at the pool.
  const now = Date.now();
  const scored = groups.map((g) => {
    const ageHours = (now - g.latestMs) / 3_600_000;
    const recency = Math.max(0, 1 - ageHours / 48); // 1 = fresh, 0 = 2 days old
    const coverage = Math.log2(g.sourceCount + 1) * 3; // 1 src → 3.0, 3 srcs → 6.0, 7 srcs → 9.0
    const highSignal = HIGH_SIGNAL_TRIGGERS.some((p) => p.test(g.representative.title)) ? 2 : 0;
    const score = coverage + recency * 3 + highSignal;
    return { score, g };
  });

  scored.sort((a, b) => b.score - a.score);

  console.log(
    `[rss] Deduplicated ${items.length} raw items → ${groups.length} unique stories → keeping top ${topN}`
  );

  const topNItems = scored.slice(0, topN).map((s) => s.g.representative);
  const allRanked = scored.map((s) => s.g.representative);

  // Build per-item audit entries
  const audit: DedupeAuditEntry[] = [];
  scored.forEach(({ score, g }, rankIdx) => {
    const rank = rankIdx + 1;
    const sentToClaude = rank <= topN;
    for (const item of g.members) {
      if (item === g.representative) {
        audit.push({ item, status: sentToClaude ? "sent_to_claude" : "ranked_out", rank, score });
      } else {
        audit.push({
          item,
          status: "deduplicated",
          rank,
          score,
          groupedWith: g.representative.title,
          groupedWithSource: g.representative.source,
        });
      }
    }
  });

  return { topN: topNItems, allRanked, audit };
}

// ─── Claude enrichment ───────────────────────────────────────────────────────

interface ClaudeDecision {
  sourceIndex: number;
  selected: boolean;
  rejectionReason?: string;
}

/**
 * Fixes literal newlines/tabs inside JSON string values — a common Claude output issue.
 * Iterates character-by-character to stay inside string boundaries correctly.
 */
/**
 * Extracts the first complete JSON array of objects (or empty array []) from
 * a string that may contain a reasoning preamble before the actual JSON.
 * Uses bracket counting to avoid the greedy-regex trap where [n] references
 * in Claude's reasoning preamble get merged with the real array.
 */
function extractJsonArray(text: string): string | null {
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const startIdx = text.indexOf("[", searchFrom);
    if (startIdx === -1) return null;
    // Walk forward counting brackets to find the matching ]
    let depth = 0;
    let inStr = false;
    let esc = false;
    let endIdx = -1;
    for (let i = startIdx; i < text.length; i++) {
      const c = text[i];
      if (esc) { esc = false; continue; }
      if (c === "\\" && inStr) { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "[") depth++;
      else if (c === "]") { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    if (endIdx === -1) return null;
    const candidate = text.slice(startIdx, endIdx + 1);
    // Accept arrays of objects [{ ... }] or empty arrays []
    if (/^\[\s*(\{|])/.test(candidate)) return candidate;
    searchFrom = startIdx + 1;
  }
  return null;
}

function sanitizeClaudeJson(raw: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString) {
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
    }
    out += ch;
  }
  return out;
}

// ─── Post-selection entity dedup ─────────────────────────────────────────────
// After Claude picks articles, deduplicate pairs that share a named entity
// (≥2 consecutive Title-Cased words, e.g. "Tiger Woods", "Kanye West", "GTA 6").
// The earlier item in the list (higher ranked / first selected) is kept.

function extractNamedEntities(title: string): Set<string> {
  const matches = title.match(/[A-Z][a-z]+(?:\s+[A-Z0-9][a-zA-Z0-9]*){1,3}/g) ?? [];
  return new Set(matches.map((m) => m.toLowerCase().trim()));
}

function applyEntityDedup(
  items: RawRSSItem[],
  indices: number[]
): { items: RawRSSItem[]; indices: number[] } {
  const keptItems: RawRSSItem[] = [];
  const keptIndices: number[] = [];
  const seenEntities = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const entities = extractNamedEntities(item.title);
    const hasDuplicate = [...entities].some((e) => seenEntities.has(e));
    if (hasDuplicate) {
      console.log(`[rss] Entity dedup — dropped: "${item.title}"`);
      continue;
    }
    entities.forEach((e) => seenEntities.add(e));
    keptItems.push(item);
    keptIndices.push(indices[i]);
  }
  return { items: keptItems, indices: keptIndices };
}

// ─────────────────────────────────────────────────────────────────────────────

async function enrichWithClaude(
  rawItems: RawRSSItem[],
  alreadyPublished: { title: string; link: string }[] = [],
  publishToday = false,
  promptAlreadyPublished?: { title: string; link?: string }[],
): Promise<{ articles: EnrichedArticle[]; decisions: ClaudeDecision[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const articleList = rawItems
    .map(
      (item, i) =>
        `[${i + 1}] DOMAIN: ${classifyDomain(item)} | SOURCE: ${item.source}\nDATE: ${item.pubDate}\nTITLE: ${item.title}\nDESCRIPTION: ${item.description || "(none)"}${item.imageUrl ? `\nIMAGE: ${item.imageUrl}` : ""}`
    )
    .join("\n\n---\n\n");

  // ── Helper: call Anthropic API via node:https ────────────────────────────────
  // Uses a fresh https.Agent (keepAlive: false) per request so each Claude call
  // gets its own TCP connection, fully isolated from the undici pool used by
  // the RSS batch fetches above.
  const callClaude = (userPrompt: string, maxTokens: number): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      const body = JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: userPrompt }],
      });
      const bodyBuf = Buffer.from(body, "utf-8");
      const req = https.request(
        {
          hostname: "api.anthropic.com",
          path: "/v1/messages",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Length": bodyBuf.byteLength,
          },
          agent: new https.Agent({ keepAlive: false }),
          timeout: 180_000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
          res.on("end", () => {
            try {
              const json = JSON.parse(data);
              if (json.error) {
                reject(new Error(`Anthropic API error: ${JSON.stringify(json.error).slice(0, 300)}`));
              } else {
                const content = json?.content?.[0];
                resolve(content?.type === "text" ? content.text : "");
              }
            } catch {
              reject(new Error(`Failed to parse Anthropic response: ${data.slice(0, 200)}`));
            }
          });
        }
      );
      req.on("timeout", () => req.destroy(new Error("Claude API request timed out after 180s")));
      req.on("error", reject);
      req.write(bodyBuf);
      req.end();
    });

  // ── Call 1: Selection ────────────────────────────────────────────────────────
  // Pass 7-day history as recentTitles for cross-day dedup in the prompt.
  // Exclude titles already shown in promptAlreadyPublished (today's feed) to avoid duplication.
  const todayTitleSet = new Set((promptAlreadyPublished ?? []).map((a) => a.title));
  const recentTitles = alreadyPublished
    .map((a) => a.title)
    .filter((t) => !todayTitleSet.has(t));
  const selectionPrompt = buildRefreshPrompt(articleList, promptAlreadyPublished ?? alreadyPublished, today, recentTitles);

  console.log("[rss] Call 1/2 — selecting articles...");
  const selectionText = await callClaude(selectionPrompt, 2000);

  const selectionArray = extractJsonArray(selectionText);
  if (!selectionArray) throw new Error("Call 1: Claude did not return a JSON array");
  const selectionParsed: any[] = JSON.parse(sanitizeClaudeJson(selectionArray));

  const selectedIndices = selectionParsed.map((x: any) => x.sourceIndex as number).filter(Boolean);
  const selectedRawItems = selectedIndices.map((idx) => rawItems[idx - 1]).filter(Boolean);

  // Build decisions for audit: selected = in response, rejected = everything else
  const selectedSet = new Set(selectedIndices);
  const decisions: ClaudeDecision[] = rawItems.map((_, i) => {
    const sourceIndex = i + 1;
    return selectedSet.has(sourceIndex)
      ? { sourceIndex, selected: true }
      : { sourceIndex, selected: false, rejectionReason: "Not selected by Claude" };
  });
  console.log(`[rss] Call 1 complete — ${selectedRawItems.length} selected, ${rawItems.length - selectedRawItems.length} rejected`);

  // ── Post-selection entity dedup ───────────────────────────────────────────
  const { items: dedupedRawItems, indices: dedupedIndices } = applyEntityDedup(selectedRawItems, selectedIndices);
  if (dedupedRawItems.length < selectedRawItems.length) {
    console.log(`[rss] Entity dedup removed ${selectedRawItems.length - dedupedRawItems.length} duplicate(s) → ${dedupedRawItems.length} to enrich`);
  }

  // ── Call 2: Enrichment — batched in groups of 5 to prevent socket timeouts ──
  // Large article counts in a single call produce responses too big for the socket.
  const ENRICH_BATCH = 3;
  const batchCount = Math.ceil(dedupedRawItems.length / ENRICH_BATCH);

  const makeEnrichmentPrompt = (articleList: string, count: number) =>
    `You are the editorial voice for Popcorn — a cultural lens app that surfaces what actually matters in culture right now. Today is ${today}.

Write full articles for each of the ${count} stories below.

WRITING RULES:
- ALWAYS use real names. Every headline and the first sentence MUST name the actual person, album, film, show, app, platform or company — never "the app", "the platform", "the company", "the service", "the brand", "the artist" or any other generic substitute. If a product or brand is central to the story, name it every time it is referenced, not just on first mention.
- PRESERVE KEY SPECIFICS. If the source names a specific model, product, feature, track, award, or proper noun (e.g. a model name like "Muse Spark", a song title, an award name), you MUST include it in the article. Never replace a specific name with a vague description like "a new model" or "a new feature".
- NEVER LEAVE THE READER HANGING. If a mystery was solved, say what the answer was. If someone was caught cheating, say how. If a deal was struck, name the terms. If evidence was found, say what it showed. If something was revealed, say what it is. The substance IS the story. The reader should never finish the article thinking "okay but what actually happened?"
- PRESERVE THE HOOK IN THE HEADLINE. If the source headline already contains the story's genuine twist, surprise, reversal, or hidden fact (signal words: "doesn't know", "unknowingly", "secretly", "turns out", "while actually", "without realising", "revealed to be", named quote, unexpected cause, etc.), that element MUST survive in your headline. Do not paraphrase it away in the name of brevity — a 14–16 word headline that lands the hook is better than a 10-word headline that strips it. Example: source "Mother Doesn't Know Her Son Died Because She's Been Talking to an AI Version of Him" → your headline keeps the "doesn't know / still talking to AI version" tension. It does NOT become "Mom Talks to AI Clone of Dead Son" (which implies she knows, and kills the story).
- HEADLINES NAME THE CAUSE / TRIGGER when it is what makes the story interesting. If a policy was signed because of a celebrity text, name the celebrity. If a quote is the whole point of the story, put the quote (or its essence) in the headline. If the triggering event is a surprise, it goes in the headline, not buried in paragraph two.
- Write like you are talking to a friend. Short sentences. Simple words. No jargon.
- No dashes or hyphens used as pauses in sentences. Use plain punctuation.
- No bullet points inside the story content.
- Keep it upbeat and engaging. Tell people why they should care.
- Paragraphs MUST be separated by a blank line (\\n\\n). Never run paragraphs together.
- If a story references something unfamiliar (an award, a franchise, a past incident), briefly explain it in plain English. Do not assume the reader already knows.
- Depth depends on the story type. For BREAKING and RELEASE stories, keep it tight: 3 to 4 short paragraphs. For FEATURE, TREND, HOT TAKE, REVIEW, and INTERVIEW stories, go deeper: 5 to 6 short paragraphs. Add analysis, context, or perspective beyond the headline facts. Include specific numbers, dates, or quotes from the source to give readers the full picture.
- For stories with past-event context (sequels, legal disputes, returning artists), include a brief 1–2 sentence backstory so new readers are not lost.

ARTICLES:
${articleList}

For each article output a JSON object:
{
  "title": "Punchy headline — HARD TARGET 8–11 words / 50–70 characters, HARD CAP 12 words / 80 characters. NEVER exceed 80 characters: the mobile home feed clamps headlines to 4 lines at ~22px and anything longer gets cut off. Before submitting, count BOTH words AND characters (including spaces): if either exceeds the cap, tighten. Techniques: drop the trailing clause ('… and Dropping Exclusive Limited-Edition Vinyl' cut entirely), collapse filler verbs ('is raising'→'sparks', 'has a new deal to take over'→'takes over'), remove decorative adjectives ('historic', 'iconic', 'exclusive', 'limited-edition'), flatten stacked prepositional phrases. The body covers detail; the headline only needs to land the moment. Capture: real person/product/company name AND the hook/twist/named-cause. MUST include real names — no generics. If the only way to fit a quote hook is to exceed 80 chars, prefer a tighter paraphrase that keeps the named actor.",
  "summary": "2–3 sentences. First sentence names who/what and what happened. Second sentence says why it matters or gives key context. Optional third sentence for a striking detail, number, or quote that hooks the reader.",
  "content": "3–4 paragraphs for BREAKING/RELEASE, 5–6 for FEATURE/TREND/HOT TAKE/REVIEW/INTERVIEW. Separated by \\n\\n. Conversational tone. Simple words. No dashes as punctuation. Name real people and things throughout. Include brief backstory where needed. Weave in specific numbers, dates, quotes, or details from the source — readers want the full picture, not just the headline.",
  "keyPoints": ["3 to 5 short plain-English takeaways (no dashes, no jargon)"],
  "signalScore": 0-100 (cultural significance / buzz level),
  "tag": "ONE of: BREAKING | HOT TAKE | REVIEW | INTERVIEW | FEATURE | RELEASE | TREND",
  "category": "ONE of: Film & TV | Music | Gaming | Fashion | Internet | Tech | AI | Culture | World | Industry | Books | Science | Sports. Assign based on what the story REPRESENTS culturally, not the company or platform it involves. AI: any story about AI tools, models, AI-generated content, or AI's impact on creative or social behaviour — regardless of which company built it (Google, Meta, OpenAI, etc.). Tech: consumer hardware, gadgets, software products, or platform business news that is NOT about AI. Internet: viral incidents, memes, TikTok or social media moments, creator economy. Fashion: style, brands, streetwear, beauty, designer collaborations. A story about an AI deepfake feature is AI, not Tech. A story about a K-pop star becoming a brand ambassador is Fashion, not Music.",
  "source": "Original source name",
  "imageUrl": "The IMAGE URL from the source article if one was provided, otherwise null",
  "wikiSearchQuery": "Search query for the article's main SUBJECT — prioritise the specific title over the person. Wikipedia pages for films, albums, and shows use poster/cover art as their main image, making far better hero images than headshots. Rules: (1) Film/TV → use the title + year: 'Challengers 2024 film', 'The White Lotus season 3', 'Black Mirror TV series'. (2) Music → use artist + album if known: 'Taylor Swift Tortured Poets Department album', 'BTS Map of the Soul Persona', else just the artist 'John Summit DJ'. (3) Gaming → game title: 'The Last of Us Part II game'. (4) If the story is purely about a person (death, scandal, tour announcement with no specific release), use name + role: 'Celine Dion singer', 'Tiger Woods golfer'.",
  "readTimeMinutes": <integer 2–6>,
  "sourceIndex": <the [N] number in the list above — use the global number, not 1>
}

Respond with ONLY a valid JSON array — no markdown, no code fences, no commentary.`;

  console.log(`[rss] Call 2/2 — writing ${dedupedRawItems.length} articles in ${batchCount} batch(es)...`);

  const selectedItems: any[] = [];
  for (let b = 0; b < batchCount; b++) {
    const batchItems = dedupedRawItems.slice(b * ENRICH_BATCH, (b + 1) * ENRICH_BATCH);
    const offset = b * ENRICH_BATCH;
    const batchList = batchItems
      .map((item, i) =>
        `[${offset + i + 1}] SOURCE: ${item.source}\nDATE: ${item.pubDate}\nTITLE: ${item.title}\nDESCRIPTION: ${item.description || "(none)"}${item.imageUrl ? `\nIMAGE: ${item.imageUrl}` : ""}`
      )
      .join("\n\n---\n\n");

    const batchText = await callClaude(makeEnrichmentPrompt(batchList, batchItems.length), 10000);
    const batchArray = extractJsonArray(batchText);
    if (!batchArray) throw new Error(`Call 2 batch ${b + 1}: Claude did not return a JSON array`);
    selectedItems.push(...JSON.parse(sanitizeClaudeJson(batchArray)));
  }

  // sourceIndex from each batch is globally numbered (offset + i + 1),
  // mapping into dedupedRawItems; dedupedIndices maps back to rawItems.
  for (const item of selectedItems) {
    const originalIdx = dedupedIndices[item.sourceIndex - 1];
    if (originalIdx !== undefined) item._originalSourceIndex = originalIdx;
  }

  console.log(`[rss] Call 2 complete — ${selectedItems.length} articles written`);

  // First pass — build articles, mark ones that still need an OG image fetch
  const articles: EnrichedArticle[] = await Promise.all(selectedItems.map(async (item: any, i: number) => {
    const cat = item.category in CATEGORY_GRADIENTS ? item.category : "Internet";
    const [gradientStart, gradientEnd] = CATEGORY_GRADIENTS[cat];
    const rssImageUrl = typeof item.imageUrl === "string" ? item.imageUrl : null;
    let imageUrl: string | null = null;
    if (isGoodImageUrl(rssImageUrl)) {
      const rssDims = await fetchImageDimensions(rssImageUrl!);
      if (!rssDims || rssDims.width >= 400) {
        imageUrl = rssImageUrl!;
        trackImageUrl(imageUrl);
      }
    }

    // sourceIndex from Call 2 is 1-based within selectedRawItems; _originalSourceIndex maps back to rawItems
    const originalRawItem = rawItems[(item._originalSourceIndex ?? item.sourceIndex) - 1];

    return {
      id: i + 1,
      title: String(item.title ?? ""),
      summary: String(item.summary ?? ""),
      content: String(item.content ?? ""),
      category: cat,
      source: String(item.source ?? "Unknown"),
      readTimeMinutes: Number(item.readTimeMinutes) || 5,
      publishedAt: (() => {
        // publishToday: stamp everything with today's date so articles fetched
        // from a wider lookback window (e.g. yesterday noon) appear in today's
        // section of the feed rather than being bucketed into a past day.
        if (publishToday) return new Date().toISOString();
        if (originalRawItem?.pubDate) {
          const d = new Date(originalRawItem.pubDate);
          if (!isNaN(d.getTime())) return d.toISOString();
        }
        return new Date().toISOString();
      })(),
      likes: Math.floor(Math.random() * 4500) + 500,
      isBookmarked: false,
      gradientStart,
      gradientEnd,
      tag: String(item.tag ?? "ANALYSIS"),
      link: originalRawItem?.link ?? null,
      imageUrl: imageUrl ?? `__NEEDS_OG__${originalRawItem?.link ?? ""}`,
      wikiSearchQuery: typeof item.wikiSearchQuery === "string" ? item.wikiSearchQuery : "",
      keyPoints: Array.isArray(item.keyPoints) ? item.keyPoints : [],
      signalScore: typeof item.signalScore === "number" ? item.signalScore : null,
    } satisfies EnrichedArticle;
  }));

  // Second pass — intent-aware multi-candidate scoring engine.
  // All sources are collected in parallel per article; selectBestImage() scores
  // every candidate and picks the highest-scoring image.
  const ogNeeded = articles.filter((a) => a.imageUrl?.startsWith("__NEEDS_OG__"));
  if (ogNeeded.length > 0) {
    console.log(`[rss] Selecting images for ${ogNeeded.length} articles…`);
    await Promise.all(
      ogNeeded.map(async (article, idx) => {
        const articleUrl = (article.imageUrl as string).replace("__NEEDS_OG__", "");
        const result = await selectBestImage(article, articleUrl, null, idx);
        article.imageUrl  = result.url;
        if (result.width)  article.imageWidth  = result.width;
        if (result.height) article.imageHeight = result.height;
        if (result.focalX !== undefined) article.imageFocalX = result.focalX;
        if (result.focalY !== undefined) article.imageFocalY = result.focalY;
        if (result.safeW !== undefined) article.imageSafeW = result.safeW;
        if (result.safeH !== undefined) article.imageSafeH = result.safeH;
      })
    );
  }

  // Fetch pixel dimensions + focal points for first-pass RSS-winner articles.
  // (selectBestImage already handles both for OG-needed articles.)
  await Promise.all(
    articles
      .filter((a) => a.imageUrl && !a.imageUrl.startsWith("__NEEDS_OG__") && !a.imageWidth)
      .map(async (article) => {
        const dims = await fetchImageDimensions(article.imageUrl!);
        if (dims) { article.imageWidth = dims.width; article.imageHeight = dims.height; }
      })
  );
  await Promise.all(
    articles
      .filter((a) => a.imageUrl && !a.imageUrl.startsWith("__NEEDS_OG__") && (a.imageFocalX == null || a.imageSafeW == null))
      .map(async (article) => {
        const focal = await detectImageFocalPoint(article.imageUrl!);
        if (focal) {
          article.imageFocalX = focal.x;
          article.imageFocalY = focal.y;
          article.imageSafeW  = focal.safeW;
          article.imageSafeH  = focal.safeH;
        }
      })
  );

  return { articles, decisions };
}

// ─── Cache + public API ───────────────────────────────────────────────────────

function cachePath(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const hourBlock = Math.floor(now.getHours() / 2); // 0–11, refreshes every 2 hours
  return path.join("/tmp", `popcorn-articles-${dateStr}-${hourBlock}.json`);
}

/** Returns the set of article links Claude already rejected in today's runs. */
function loadTodayRejectedLinks(): Set<string> {
  try {
    const dateStr = new Date().toISOString().slice(0, 10);
    const auditPath = `/tmp/popcorn-audit-${dateStr}.json`;
    if (!fs.existsSync(auditPath)) return new Set();
    const data = JSON.parse(fs.readFileSync(auditPath, "utf-8"));
    const articles: any[] = data?.articles ?? [];
    return new Set(
      articles
        .filter((e) => e.stage === "rejected_by_claude")
        .map((e) => e.link)
        .filter(Boolean)
    );
  } catch {
    return new Set();
  }
}

function _writeAuditFile(
  toEnrich: RawRSSItem[],
  dedupAudit: DedupeAuditEntry[],
  decisions: ClaudeDecision[]
): void {
  try {
    const dateStr = new Date().toISOString().slice(0, 10);
    const auditPath = `/tmp/popcorn-audit-${dateStr}.json`;
    const decisionByIdx = new Map(decisions.map((d) => [d.sourceIndex, d]));
    const claudeIndexByTitle = new Map(toEnrich.map((item, i) => [item.title, i + 1]));

    const auditEntries = dedupAudit.map(({ item, status, rank, score, groupedWith, groupedWithSource }) => {
      const base = {
        title: item.title,
        source: item.source,
        pubDate: item.pubDate,
        link: item.link,
        dedupRank: rank,
        dedupScore: Math.round(score * 100) / 100,
      };
      if (status === "deduplicated") {
        return { ...base, stage: "deduplicated", reason: `Grouped as duplicate of "${groupedWith}" (${groupedWithSource})` };
      }
      if (status === "ranked_out") {
        return { ...base, stage: "ranked_out", reason: `Unique story but ranked #${rank} — outside top 25 sent to Claude`, _raw: item };
      }
      const claudeIdx = claudeIndexByTitle.get(item.title);
      const decision = claudeIdx !== undefined ? decisionByIdx.get(claudeIdx) : undefined;
      if (!decision || decision.selected) {
        return { ...base, stage: "selected", reason: "Selected by editorial AI" };
      }
      return { ...base, stage: "rejected_by_claude", reason: decision.rejectionReason ?? "(no reason given)", _raw: item };
    });

    const selectedCount  = auditEntries.filter((e) => e.stage === "selected").length;
    const rejectedCount  = auditEntries.filter((e) => e.stage === "rejected_by_claude").length;
    const rankedOutCount = auditEntries.filter((e) => e.stage === "ranked_out").length;
    const dedupedCount   = auditEntries.filter((e) => e.stage === "deduplicated").length;

    const auditPayload = JSON.stringify({
      fetchedAt: new Date().toISOString(),
      totalRawItems: dedupAudit.length,
      uniqueStories: dedupAudit.filter((e) => e.status !== "deduplicated").length,
      sentToClaude: toEnrich.length,
      selectedCount,
      rejectedCount,
      rankedOutCount,
      dedupedCount,
      articles: auditEntries,
    }, null, 2);

    // Write to /tmp (ephemeral) — this window's data only
    fs.writeFileSync(auditPath, auditPayload);
    console.log(`[rss] ✓ Wrote full audit to ${auditPath} (${dedupAudit.length} raw → ${toEnrich.length} to Claude → ${selectedCount} selected)`);

    const dataDir = path.resolve(process.cwd(), "data", "uncurated");
    fs.mkdirSync(dataDir, { recursive: true });

    // Save per-fetch snapshot (never overwritten)
    const existingFetches = fs.readdirSync(dataDir)
      .filter((f) => new RegExp(`^uncurated-${dateStr}-fetch\\d+\\.json$`).test(f)).length;
    const fetchN = existingFetches + 1;
    const fetchPath = path.join(dataDir, `uncurated-${dateStr}-fetch${fetchN}.json`);
    fs.writeFileSync(fetchPath, auditPayload);
    console.log(`[rss] ✓ Saved fetch #${fetchN} snapshot → ${fetchPath}`);

    // Merge with existing combined file (append across windows, dedup by link)
    const committedPath = path.join(dataDir, `uncurated-${dateStr}.json`);
    let existingArticles: typeof auditEntries = [];
    if (fs.existsSync(committedPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(committedPath, "utf-8"));
        existingArticles = existing.articles ?? [];
      } catch { /* start fresh */ }
    }

    // New window's entry wins if same link appears in both (fresher stage/reason)
    const byLink = new Map(existingArticles.map((a) => [a.link, a]));
    for (const entry of auditEntries) byLink.set(entry.link, entry);
    const merged = Array.from(byLink.values())
      .sort((a, b) => (b.dedupScore ?? 0) - (a.dedupScore ?? 0));

    const combinedPayload = JSON.stringify({
      fetchedAt: new Date().toISOString(),
      fetchCount: fetchN,
      totalRawItems: merged.length,
      uniqueStories: merged.filter((e) => e.stage !== "deduplicated").length,
      sentToClaude: merged.filter((e) => e.stage !== "deduplicated" && e.stage !== "ranked_out").length,
      selectedCount: merged.filter((e) => e.stage === "selected").length,
      rejectedCount: merged.filter((e) => e.stage === "rejected_by_claude").length,
      rankedOutCount: merged.filter((e) => e.stage === "ranked_out").length,
      dedupedCount: merged.filter((e) => e.stage === "deduplicated").length,
      articles: merged,
    }, null, 2);

    fs.writeFileSync(committedPath, combinedPayload);
    console.log(`[rss] ✓ Combined uncurated list → ${committedPath} (${merged.length} total across ${fetchN} window(s))`);

    // Persist combined data to Supabase (delete+re-insert since idx positions change after merge)
    _saveShortlistToSupabase(merged as typeof auditEntries, dateStr).catch((e) =>
      console.warn("[rss] Failed to save candidates to Supabase:", e)
    );

    // Regenerate human-readable .txt from combined data
    _writeUncuratedTxt(merged as typeof auditEntries, dateStr, fetchN);
  } catch (e) {
    console.warn("[rss] Could not write audit file:", e);
  }
}

async function _saveShortlistToSupabase(
  auditEntries: { title: string; source: string; pubDate: string; link: string; dedupRank: number; dedupScore: number; stage: string; reason: string; _raw?: { description?: string; imageUrl?: string } }[],
  dateStr: string
): Promise<void> {
  const rows = auditEntries.map((entry, i) => ({
    feed_date: dateStr,
    idx: i + 1,
    title: entry.title,
    source: entry.source,
    description: entry._raw?.description ?? null,
    pub_date: entry.pubDate,
    link: entry.link,
    image_url: entry._raw?.imageUrl ?? null,
    stage: entry.stage,
    reason: entry.reason ?? null,
    raw_data: entry._raw ?? null,
  }));
  await supabase.from("shortlist_candidates").delete().eq("feed_date", dateStr);
  const { error } = await supabase.from("shortlist_candidates").insert(rows);
  if (error) throw new Error(error.message);
  console.log(`[rss] ✓ Saved ${rows.length} candidates to Supabase shortlist_candidates`);
}

function _writeUncuratedTxt(
  auditEntries: { title: string; source: string; pubDate: string; link: string; dedupRank: number; dedupScore: number; stage: string; reason: string }[],
  dateStr: string,
  fetchCount = 1
): void {
  try {
    const [year, month, day] = dateStr.split("-");
    const ddmmyy = `${day}_${month}_${year.slice(2)}`;
    const BORDER = "═".repeat(100);

    const decodeHtml = (s: string) =>
      s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
       .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
       .replace(/&quot;/g, '"').replace(/&apos;/g, "'");

    const allSorted = [...auditEntries]
      .filter((a) => a.stage !== "deduplicated")
      .sort((a, b) => b.dedupScore - a.dedupScore || (a.stage === "selected" ? -1 : 1));
    const selected = auditEntries.filter((a) => a.stage === "selected");
    const dupes    = auditEntries.filter((a) => a.stage === "deduplicated");
    const total    = auditEntries.length;
    const unique   = auditEntries.filter((a) => a.stage !== "deduplicated").length;

    const lines: string[] = [];
    lines.push(BORDER);
    lines.push(`  POPCORN CANDIDATES — ${dateStr}   (${fetchCount} window${fetchCount === 1 ? "" : "s"} merged)`);
    lines.push(`  ${total} articles fetched   ${unique} unique stories   ${selected.length} selected by Claude`);
    lines.push(BORDER);
    lines.push("");

    lines.push(`── FIRST PASS — Claude's picks (${selected.length} selected) ${"─".repeat(60)}`);
    if (selected.length > 0) {
      selected.forEach((a, i) => {
        const score = Math.round(a.dedupScore);
        const src = a.source.slice(0, 28).padEnd(28);
        lines.push(`  #${String(i + 1).padEnd(4)} ${String(score).padEnd(5)} ${src}  ${decodeHtml(a.title)}`);
      });
    } else {
      lines.push("  (none selected this run)");
    }
    lines.push("");

    lines.push(`── ALL CANDIDATES (sorted by score) ${"─".repeat(65)}`);
    let rank = 0;
    for (const a of allSorted) {
      rank++;
      const score = Math.round(a.dedupScore);
      const src = a.source.slice(0, 28).padEnd(28);
      const prefix = a.stage === "selected" ? " ✓" : "  ";
      lines.push(`${prefix} #${String(rank).padEnd(4)} ${String(score).padEnd(5)} ${src}  ${decodeHtml(a.title)}`);
      if (a.stage === "rejected_by_claude" && a.reason && a.reason !== "Not selected by Claude") {
        lines.push(`${" ".repeat(43)}↳ ${a.reason.slice(0, 85)}`);
      }
    }
    lines.push("");

    if (dupes.length > 0) {
      lines.push(`── GROUPED DUPLICATES (excluded from candidate pool) ${"─".repeat(50)}`);
      for (const a of dupes) {
        const src = a.source.slice(0, 28).padEnd(28);
        lines.push(`   ${src}  ${decodeHtml(a.title).slice(0, 70)}`);
        lines.push(`${"".padEnd(32)}↳ ${a.reason.slice(0, 85)}`);
      }
      lines.push("");
    }

    // Resolve path relative to this package root (api-server/../../../Uncurated Lists)
    const listDir = path.resolve(process.cwd(), "..", "..", "Uncurated Lists");
    fs.mkdirSync(listDir, { recursive: true });
    const txtPath = path.join(listDir, `${ddmmyy}_uncurated_list.txt`);
    fs.writeFileSync(txtPath, lines.join("\n"), "utf-8");
    console.log(`[rss] ✓ Uncurated list written → ${txtPath}`);
  } catch (e) {
    console.warn("[rss] Could not write uncurated .txt:", e);
  }
}

// In-memory cache tracks the 2-hour block key so it auto-expires mid-session
let _inMemoryCache: EnrichedArticle[] | null = null;
let _inMemoryCacheKey: string | null = null;

// Holds the last-fetched raw items + dedup audit so Claude-call retries
// don't need to re-fetch all RSS feeds (which re-saturates the connection pool).
let _pendingRawItems: RawRSSItem[] | null = null;
let _pendingDedupAudit: DedupeAuditEntry[] | null = null;

/**
 * Load the latest batch of live articles from RSS + Claude.
 * Always runs fresh — the curated-store handles daily persistence.
 *
 * @param alreadyPublished - Articles already in today's curated feed. Claude
 *   will be told not to re-select these, and their links are pre-filtered out.
 */
/**
 * Canonical RSS feed list — single source of truth for both the
 * enrichment pipeline (`loadLiveArticles`) and the shortlist ranker
 * (`generateShortlist`). Category comments are for readers; fetch
 * treats every feed equally. Add or remove sources here only.
 */
export const RSS_FEEDS: [string, string][] = [
  // ── Core sources ───────────────────────────────────────────────────────────
  // Music
  ["https://www.rollingstone.com/feed/",                             "Rolling Stone"],
  ["https://www.billboard.com/feed/",                                "Billboard"],
  ["https://pitchfork.com/rss/news/",                                "Pitchfork"],
  ["https://www.stereogum.com/feed/",                                "Stereogum"],
  ["https://consequence.net/feed/",                                  "Consequence"],
  // Film & TV
  ["https://variety.com/feed/",                                      "Variety"],
  ["https://www.hollywoodreporter.com/feed/",                        "The Hollywood Reporter"],
  ["https://www.indiewire.com/feed/",                                "IndieWire"],
  ["https://deadline.com/feed",                                      "Deadline"],
  ["https://www.vanityfair.com/feed/rss",                            "Vanity Fair"],
  // Vulture removed — RSS feed was killed by NY Mag (returns 404; no <link rel="alternate"> in their HTML).
  // Culture coverage overlap: NYT Arts, The Guardian Culture, The New Yorker.
  // Gaming
  ["https://www.polygon.com/rss/index.xml",                          "Polygon"],
  ["https://feeds.feedburner.com/ign/all",                           "IGN"],
  // Fashion & Taste
  ["https://hypebeast.com/feed",                                     "Hypebeast"],
  ["https://www.dazeddigital.com/rss",                               "Dazed"],
  ["https://www.businessoffashion.com/feeds/news/",                  "Business of Fashion"],
  // Culture, Ideas, Tech
  ["https://www.theatlantic.com/feed/all/",                          "The Atlantic"],
  ["https://www.wired.com/feed/rss",                                 "Wired"],
  ["https://www.theguardian.com/culture/rss",                        "The Guardian Culture"],
  ["https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml",          "NYT Arts"],
  ["https://www.newyorker.com/feed/everything",                      "The New Yorker"],
  ["https://feeds.feedburner.com/TheRinger",                         "The Ringer"],
  // AI & Tech culture — dedicated sources for AI/internet behavior signals
  ["https://www.theverge.com/rss/index.xml",                         "The Verge"],
  ["https://techcrunch.com/feed/",                                   "TechCrunch"],
  ["https://feeds.arstechnica.com/arstechnica/index",                "Ars Technica"],
  ["https://www.technologyreview.com/feed/",                         "MIT Technology Review"],
  ["https://www.engadget.com/rss.xml",                               "Engadget"],
  // Global fandom & music scale — international chart records, fan-driven events
  ["https://www.nme.com/feed",                                       "NME"],
  // Sports (cultural crossover only)
  ["https://www.espn.com/espn/rss/news",                             "ESPN"],
  ["https://www.skysports.com/rss/12040",                            "Sky Sports"],
  ["https://www.skysports.com/rss/11095",                            "Sky Sports Football"],
  ["https://feeds.bbci.co.uk/sport/rss.xml",                         "BBC Sport"],
  ["https://defector.com/feed",                                      "Defector"],
  // ── Supplementary sources ─────────────────────────────────────────────────
  // Internet & Emerging Culture — memes, trends, online discourse
  ["https://www.dexerto.com/feed/",                                  "Dexerto"],
  ["https://knowyourmeme.com/newsfeed.rss",                          "Know Your Meme"],
  // Power & Industry Insight — strategy, business of culture
  ["https://www.semafor.com/rss.xml",                                "Semafor"],
  ["https://feeds2.feedburner.com/businessinsider",                  "Business Insider"],
  ["https://puck.news/feed/",                                        "Puck"],
  // Science & emerging tech with cultural resonance
  ["https://futurism.com/feed",                                      "Futurism"],
  ["https://www.404media.co/rss/",                                   "404 Media"],
  // Modern Taste & Aesthetic Culture — youth culture, fashion signals
  ["https://www.highsnobiety.com/feed/",                             "Highsnobiety"],
  // Business & Innovation
  ["https://www.inc.com/rss",                                        "Inc."],
  ["https://www.fastcompany.com/latest/rss",                         "Fast Company"],
  // ── Low-weight signal sources (early detection only) ─────────────────────
  ["https://www.dailymail.co.uk/home/index.rss",                     "Daily Mail"],
  ["https://pagesix.com/feed/",                                      "Page Six"],
];

export async function loadLiveArticles(
  alreadyPublished: { title: string; link: string }[] = [],
  windowStart?: Date,
  publishToday = false,
  windowEnd?: Date,
  promptAlreadyPublished?: { title: string; link?: string }[],
): Promise<EnrichedArticle[]> {
  // If a previous attempt already fetched + deduped the RSS items, skip straight
  // to Claude — re-fetching would re-saturate undici's connection pool.
  if (_pendingRawItems && _pendingDedupAudit) {
    console.log(`[rss] Re-using ${_pendingRawItems.length} cached candidates — skipping RSS fetch.`);
    const { articles: enriched, decisions } = await enrichWithClaude(_pendingRawItems, alreadyPublished, publishToday, promptAlreadyPublished);
    _writeAuditFile(_pendingRawItems, _pendingDedupAudit, decisions);
    _pendingRawItems = null;
    _pendingDedupAudit = null;
    return enriched;
  }

  // Fetch RSS feeds
  console.log("[rss] Fetching RSS feeds…");
  const feeds = RSS_FEEDS;

  // Fetch in batches of 5 — prevents undici's connection pool from becoming
  // saturated (which corrupts all subsequent network calls, including Claude).
  const BATCH = 5;
  const results: PromiseSettledResult<RawRSSItem[]>[] = [];
  for (let i = 0; i < feeds.length; i += BATCH) {
    const batch = feeds.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(
      batch.map(([url, name]) => fetchFeed(url, name))
    );
    results.push(...batchResults);
    if (i + BATCH < feeds.length) await new Promise((r) => setTimeout(r, 150));
  }

  // Sort by most recent first so Claude sees the freshest stories at the top
  const allItems = results
    .filter((r): r is PromiseFulfilledResult<RawRSSItem[]> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => {
      const tA = new Date(a.pubDate).getTime();
      const tB = new Date(b.pubDate).getTime();
      if (isNaN(tA) && isNaN(tB)) return 0;
      if (isNaN(tA)) return 1;
      if (isNaN(tB)) return -1;
      return tB - tA;
    });

  // Time window: use explicit windowStart if provided, otherwise default to last 25 hours.
  // 25h (vs 24h) ensures we always reach back to at least noon the previous day in any timezone.
  const cutoff = windowStart ? windowStart.getTime() : Date.now() - 25 * 60 * 60 * 1000;
  const endMs = windowEnd ? windowEnd.getTime() : Infinity;
  const recentItems = allItems.filter((item) => {
    const t = new Date(item.pubDate).getTime();
    return !isNaN(t) && t >= cutoff && t <= endMs;
  });

  const windowDesc = windowStart
    ? windowEnd
      ? `${windowStart.toISOString()} → ${windowEnd.toISOString()}`
      : `since ${windowStart.toISOString()}`
    : "last 25h";
  console.log(`[rss] Total raw items: ${allItems.length} (${recentItems.length} ${windowDesc})`);

  if (recentItems.length < 5) {
    throw new Error(`Only ${recentItems.length} articles in window — too few to enrich`);
  }

  // Strip junk titles (promo codes, puzzle answers, how-to guides)
  const cleanItems = recentItems.filter(
    (item) => !JUNK_TITLE_PATTERNS.some((p) => p.test(item.title))
  );
  const junkCount = recentItems.length - cleanItems.length;
  if (junkCount > 0) {
    console.log(`[rss] Filtered out ${junkCount} junk articles (promo codes, puzzle answers, guides)`);
  }

  // Pre-filter out articles whose link is already in today's published feed
  const publishedLinks = new Set(alreadyPublished.map((a) => a.link).filter(Boolean));
  const linkFilteredItems = publishedLinks.size > 0
    ? cleanItems.filter((item) => !publishedLinks.has(item.link))
    : cleanItems;
  if (publishedLinks.size > 0) {
    console.log(`[rss] ${linkFilteredItems.length} new items after excluding ${publishedLinks.size} already-published links`);
  }

  // Also remove items whose title is too similar to an already-published story,
  // so their dedup groups don't consume ranking slots.
  let filteredItems = linkFilteredItems;
  if (alreadyPublished.length > 0) {
    const pubTokenSets = alreadyPublished.map((a) => titleTokens(a.title));
    const before = filteredItems.length;
    filteredItems = filteredItems.filter((item) => {
      const tokens = titleTokens(item.title);
      // Threshold 0.28 (down from 0.35) — paraphrased headlines from
      // different sources can drop token-overlap below 0.35 even when
      // they're clearly the same story (e.g. Apr 20 Charlize/Chalamet
      // variants). 0.28 catches those without false-positive collisions
      // on common news words.
      return !pubTokenSets.some((pt) => jaccardSim(tokens, pt) >= 0.28);
    });
    const titleFiltered = before - filteredItems.length;
    if (titleFiltered > 0) {
      console.log(`[rss] ${titleFiltered} items removed as title-duplicates of already-published stories`);
    }
  }

  // ── Exclude articles Claude already rejected in earlier runs today ───────────
  const prevRejectedLinks = loadTodayRejectedLinks();
  if (prevRejectedLinks.size > 0) {
    const before = filteredItems.length;
    filteredItems = filteredItems.filter((item) => !prevRejectedLinks.has(item.link));
    const excluded = before - filteredItems.length;
    if (excluded > 0) {
      console.log(`[rss] ${excluded} items excluded — already rejected by Claude today`);
    }
  }

  // ── Domain-balanced candidate pool ──────────────────────────────────────────
  // Rank all items, then enforce minimum slots per non-entertainment domain
  // so high-signal AI/economic/fandom/internet stories can't be crowded out
  // by entertainment volume before Claude ever sees them.

  const { allRanked, audit: dedupAudit } = deduplicateAndRank(filteredItems, filteredItems.length);

  // How many candidates to guarantee per non-entertainment domain (from full ranked list)
  const DOMAIN_SLOTS: Partial<Record<SignalDomain, number>> = {
    AI_TECH:      10,
    ECONOMIC:      8,
    FANDOM:        8,
    INTERNET:      6,
    SPORTS:       12,
    CROSSDOMAIN:   5,
  };
  const ENTERTAINMENT_CAP = 40; // max entertainment slots

  // Group all ranked items by domain (preserving rank order within each group)
  const byDomain = new Map<SignalDomain, RawRSSItem[]>();
  for (const item of allRanked) {
    const d = classifyDomain(item);
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d)!.push(item);
  }

  const candidateSet = new Set<RawRSSItem>();

  // Step 1: fill guaranteed domain slots (non-entertainment first)
  for (const [domain, slots] of Object.entries(DOMAIN_SLOTS) as [SignalDomain, number][]) {
    (byDomain.get(domain) ?? []).slice(0, slots).forEach((item) => candidateSet.add(item));
  }

  // Step 2: fill entertainment slots up to cap
  let entCount = 0;
  for (const item of allRanked) {
    if (classifyDomain(item) === "ENTERTAINMENT" && entCount < ENTERTAINMENT_CAP) {
      candidateSet.add(item);
      entCount++;
    }
    if (candidateSet.size >= 100) break;
  }

  // Step 3: top-up any remaining slots with the next highest-ranked items (any domain)
  for (const item of allRanked) {
    if (candidateSet.size >= 100) break;
    candidateSet.add(item);
  }

  // Preserve original rank order for Claude
  const toEnrich = allRanked.filter((item) => candidateSet.has(item));

  // Log domain distribution so we can see balance in the logs
  const domainCounts: Partial<Record<SignalDomain, number>> = {};
  for (const item of toEnrich) {
    const d = classifyDomain(item);
    domainCounts[d] = (domainCounts[d] ?? 0) + 1;
  }
  console.log(
    `[rss] Candidate pool: ${toEnrich.length} stories | ` +
    Object.entries(domainCounts).map(([d, n]) => `${d}:${n}`).join(" | ")
  );
  _pendingRawItems = toEnrich;
  _pendingDedupAudit = dedupAudit;

  const { articles: enriched, decisions } = await enrichWithClaude(toEnrich, alreadyPublished, publishToday, promptAlreadyPublished);

  _writeAuditFile(toEnrich, dedupAudit, decisions);
  _pendingRawItems = null;
  _pendingDedupAudit = null;

  return enriched;
}

/** Clear caches (useful for testing) */
export function clearCache(): void {
  _inMemoryCache = null;
  const cp = cachePath();
  if (fs.existsSync(cp)) fs.unlinkSync(cp);
}

// ─── Shortlist path ───────────────────────────────────────────────────────────

function shortlistPath(): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  // Primary: project-root "Daily Curation Review" folder for manual review.
  // Falls back to /tmp if the folder can't be resolved (e.g. in CI).
  const reviewDir = path.resolve(process.cwd(), "..", "..", "Daily Curation Review");
  try {
    if (!fs.existsSync(reviewDir)) fs.mkdirSync(reviewDir, { recursive: true });
    return path.join(reviewDir, `popcorn-shortlist-${dateStr}.json`);
  } catch {
    return path.join("/tmp", `popcorn-shortlist-${dateStr}.json`);
  }
}

/**
 * Fetch, deduplicate and rank today's RSS candidates — NO Claude calls.
 * Saves the top 50 to a shortlist temp file for the user to review.
 * Returns the candidates formatted for display.
 */
export async function generateShortlist(
  alreadyPublished: { title: string; link: string }[] = [],
  windowStart?: Date,       // defaults to 24h ago
  windowEnd?: Date,         // defaults to now
  customFeeds?: [string, string][],  // if provided, replaces the default feed list
): Promise<ShortlistCandidate[]> {
  console.log("[shortlist] Fetching RSS feeds for shortlist generation…");

  const feeds = customFeeds ?? RSS_FEEDS;
  if (customFeeds) {
    console.log(`[shortlist] Using custom feed list: ${customFeeds.map(([, name]) => name).join(", ")}`);
  }

  const BATCH = 5;
  const allItems: RawRSSItem[] = [];
  for (let i = 0; i < feeds.length; i += BATCH) {
    const batch = feeds.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(([url, src]) => fetchFeed(url, src))
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      const src = batch[j][1];
      if (r.status === "fulfilled") {
        allItems.push(...r.value);
        console.log(`[shortlist] ${src}: ${r.value.length} items`);
      } else {
        console.warn(`[shortlist] ⚠ Failed to fetch ${src}: ${r.reason?.message ?? r.reason}`);
      }
    }
  }

  // Time window filter
  const startMs = windowStart ? windowStart.getTime() : Date.now() - 24 * 60 * 60 * 1000;
  const endMs   = windowEnd   ? windowEnd.getTime()   : Date.now();
  const recentItems = allItems.filter((item) => {
    const t = new Date(item.pubDate).getTime();
    return !isNaN(t) && t >= startMs && t <= endMs;
  });
  console.log(`[shortlist] ${allItems.length} raw items, ${recentItems.length} within window`);

  // Junk filter
  const junkFiltered = recentItems.filter(
    (item) => !JUNK_TITLE_PATTERNS.some((p) => p.test(item.title))
  );
  const junkRemoved = recentItems.length - junkFiltered.length;
  if (junkRemoved > 0) console.log(`[shortlist] Filtered out ${junkRemoved} junk articles`);

  // Already-published title filter
  let filteredItems = junkFiltered;
  if (alreadyPublished.length > 0) {
    const pubTokenSets = alreadyPublished.map((a) => titleTokens(a.title));
    const before = filteredItems.length;
    filteredItems = filteredItems.filter((item) => {
      const tokens = titleTokens(item.title);
      // Threshold 0.28 (down from 0.35) — paraphrased headlines from
      // different sources can drop token-overlap below 0.35 even when
      // they're clearly the same story (e.g. Apr 20 Charlize/Chalamet
      // variants). 0.28 catches those without false-positive collisions
      // on common news words.
      return !pubTokenSets.some((pt) => jaccardSim(tokens, pt) >= 0.28);
    });
    const removed = before - filteredItems.length;
    if (removed > 0) console.log(`[shortlist] ${removed} items removed as already-published`);
  }

  // Dedup + rank
  const { allRanked } = deduplicateAndRank(filteredItems, filteredItems.length);

  // Domain-balanced pool — same slots as main pipeline
  const DOMAIN_SLOTS: Partial<Record<SignalDomain, number>> = {
    AI_TECH: 10, ECONOMIC: 8, FANDOM: 8, INTERNET: 6, SPORTS: 12, CROSSDOMAIN: 5,
  };
  const ENTERTAINMENT_CAP = 30; // raised from 13 — caps are guidelines, not hard limits
  const POOL_CAP = 100;         // raised from 50 — user reviews JSON so cost is free

  const byDomain = new Map<SignalDomain, RawRSSItem[]>();
  for (const item of allRanked) {
    const d = classifyDomain(item);
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d)!.push(item);
  }

  const candidateSet = new Set<RawRSSItem>();
  for (const [domain, slots] of Object.entries(DOMAIN_SLOTS) as [SignalDomain, number][]) {
    (byDomain.get(domain) ?? []).slice(0, slots).forEach((item) => candidateSet.add(item));
  }
  let entCount = 0;
  for (const item of allRanked) {
    if (classifyDomain(item) === "ENTERTAINMENT" && entCount < ENTERTAINMENT_CAP) {
      candidateSet.add(item); entCount++;
    }
    if (candidateSet.size >= POOL_CAP) break;
  }
  for (const item of allRanked) {
    if (candidateSet.size >= POOL_CAP) break;
    candidateSet.add(item);
  }

  const pool = allRanked.filter((item) => candidateSet.has(item)).slice(0, POOL_CAP);

  // Score map from dedup audit
  const { audit: dedupAudit } = deduplicateAndRank(filteredItems, filteredItems.length);
  const scoreByLink = new Map(dedupAudit.map((e) => [e.item.link, e.score]));

  // Build shortlist candidates
  const candidates: ShortlistCandidate[] = pool.map((item, i) => ({
    index: i + 1,
    title: item.title.replace(/&#\d+;/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim(),
    source: item.source,
    description: (item.description ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/&#\d+;/g, " ")
      .replace(/&amp;/g, "&")
      .trim()
      .slice(0, 160),
    score: Math.round((scoreByLink.get(item.link) ?? 0) * 10) / 10,
    domain: classifyDomain(item),
    pubDate: item.pubDate,
    link: item.link,
    imageUrl: item.imageUrl,
    _raw: item,
  }));

  // Persist to disk so publish can look up by index
  fs.writeFileSync(shortlistPath(), JSON.stringify({ generatedAt: new Date().toISOString(), candidates }, null, 2));
  console.log(`[shortlist] ✓ Saved ${candidates.length} candidates to ${shortlistPath()}`);

  return candidates;
}

/** Load the most recently saved shortlist from disk. */
export function loadShortlist(): ShortlistCandidate[] | null {
  const p = shortlistPath();
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    return data?.candidates ?? null;
  } catch {
    return null;
  }
}

/**
 * Enrich only the user-selected articles — runs Call 2 only (no Claude selection).
 * Takes raw items directly; no Claude needed to choose them.
 */
export async function enrichSelectedItems(items: RawRSSItem[], publishToday = false): Promise<EnrichedArticle[]> {
  if (items.length === 0) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const callClaude = (userPrompt: string, maxTokens: number): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      const body = JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: userPrompt }],
      });
      const bodyBuf = Buffer.from(body, "utf-8");
      const req = https.request(
        {
          hostname: "api.anthropic.com",
          path: "/v1/messages",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Length": bodyBuf.byteLength,
          },
          agent: new https.Agent({ keepAlive: false }),
          timeout: 180_000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
          res.on("end", () => {
            try {
              const json = JSON.parse(data);
              if (json.error) {
                reject(new Error(`Anthropic API error: ${JSON.stringify(json.error).slice(0, 300)}`));
              } else {
                const content = json?.content?.[0];
                resolve(content?.type === "text" ? content.text : "");
              }
            } catch {
              reject(new Error(`Failed to parse Anthropic response: ${data.slice(0, 200)}`));
            }
          });
        }
      );
      req.on("timeout", () => req.destroy(new Error("Claude API request timed out after 180s")));
      req.on("error", reject);
      req.write(bodyBuf);
      req.end();
    });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const ENRICH_BATCH = 3;
  const batchCount = Math.ceil(items.length / ENRICH_BATCH);

  const makePrompt = (articleList: string, count: number) =>
    `You are the editorial voice for Popcorn — a cultural lens app that surfaces what actually matters in culture right now. Today is ${today}.

Write full articles for each of the ${count} stories below.

WRITING RULES:
- ALWAYS use real names. Every headline and the first sentence MUST name the actual person, album, film, show, app, platform or company — never "the app", "the platform", "the company", "the service", "the brand", "the artist" or any other generic substitute. If a product or brand is central to the story, name it every time it is referenced, not just on first mention.
- PRESERVE KEY SPECIFICS. If the source names a specific model, product, feature, track, award, or proper noun (e.g. a model name like "Muse Spark", a song title, an award name), you MUST include it in the article. Never replace a specific name with a vague description like "a new model" or "a new feature".
- NEVER LEAVE THE READER HANGING. If a mystery was solved, say what the answer was. If someone was caught cheating, say how. If a deal was struck, name the terms. If evidence was found, say what it showed. If something was revealed, say what it is. The substance IS the story. The reader should never finish the article thinking "okay but what actually happened?"
- PRESERVE THE HOOK IN THE HEADLINE. If the source headline already contains the story's genuine twist, surprise, reversal, or hidden fact (signal words: "doesn't know", "unknowingly", "secretly", "turns out", "while actually", "without realising", "revealed to be", named quote, unexpected cause, etc.), that element MUST survive in your headline. Do not paraphrase it away in the name of brevity — a 14–16 word headline that lands the hook is better than a 10-word headline that strips it. Example: source "Mother Doesn't Know Her Son Died Because She's Been Talking to an AI Version of Him" → your headline keeps the "doesn't know / still talking to AI version" tension. It does NOT become "Mom Talks to AI Clone of Dead Son" (which implies she knows, and kills the story).
- HEADLINES NAME THE CAUSE / TRIGGER when it is what makes the story interesting. If a policy was signed because of a celebrity text, name the celebrity. If a quote is the whole point of the story, put the quote (or its essence) in the headline. If the triggering event is a surprise, it goes in the headline, not buried in paragraph two.
- Write like you are talking to a friend. Short sentences. Simple words. No jargon.
- No dashes or hyphens used as pauses in sentences. Use plain punctuation.
- No bullet points inside the story content.
- Keep it upbeat and engaging. Tell people why they should care.
- Paragraphs MUST be separated by a blank line (\\n\\n). Never run paragraphs together.
- If a story references something unfamiliar (an award, a franchise, a past incident), briefly explain it in plain English.
- Depth depends on the story type. For BREAKING and RELEASE stories, keep it tight: 3 to 4 short paragraphs. For FEATURE, TREND, HOT TAKE, REVIEW, and INTERVIEW stories, go deeper: 5 to 6 short paragraphs. Add analysis, context, or perspective beyond the headline facts. Include specific numbers, dates, or quotes from the source to give readers the full picture.
- For stories with past-event context (sequels, legal disputes, returning artists), include a brief 1–2 sentence backstory.

ARTICLES:
${articleList}

For each article output a JSON object:
{
  "title": "Punchy headline — HARD TARGET 8–11 words / 50–70 characters, HARD CAP 12 words / 80 characters. NEVER exceed 80 characters: the mobile home feed clamps headlines to 4 lines at ~22px and anything longer gets cut off. Before submitting, count BOTH words AND characters (including spaces): if either exceeds the cap, tighten. Techniques: drop the trailing clause ('… and Dropping Exclusive Limited-Edition Vinyl' cut entirely), collapse filler verbs ('is raising'→'sparks', 'has a new deal to take over'→'takes over'), remove decorative adjectives ('historic', 'iconic', 'exclusive', 'limited-edition'), flatten stacked prepositional phrases. The body covers detail; the headline only needs to land the moment. Capture: real person/product/company name AND the hook/twist/named-cause. MUST include real names — no generics. If the only way to fit a quote hook is to exceed 80 chars, prefer a tighter paraphrase that keeps the named actor.",
  "summary": "2–3 sentences. First sentence names who/what and what happened. Second sentence says why it matters or gives key context. Optional third sentence for a striking detail, number, or quote that hooks the reader.",
  "content": "3–4 paragraphs for BREAKING/RELEASE, 5–6 for FEATURE/TREND/HOT TAKE/REVIEW/INTERVIEW. Separated by \\n\\n. Conversational tone. Simple words. No dashes as punctuation. Name real people, products and things throughout — never use vague substitutes. Weave in specific numbers, dates, quotes, or details from the source.",
  "keyPoints": ["3 to 5 short plain-English takeaways"],
  "signalScore": 0-100,
  "tag": "ONE of: BREAKING | HOT TAKE | REVIEW | INTERVIEW | FEATURE | RELEASE | TREND",
  "category": "ONE of: Film & TV | Music | Gaming | Fashion | Internet | Tech | AI | Culture | World | Industry | Books | Science | Sports. Assign based on what the story REPRESENTS culturally, not the company or platform it involves. AI: any story about AI tools, models, AI-generated content, or AI's impact on creative or social behaviour — regardless of which company built it (Google, Meta, OpenAI, etc.). Tech: consumer hardware, gadgets, software products, or platform business news that is NOT about AI. Internet: viral incidents, memes, TikTok or social media moments, creator economy. Fashion: style, brands, streetwear, beauty, designer collaborations. A story about an AI deepfake feature is AI, not Tech. A story about a K-pop star becoming a brand ambassador is Fashion, not Music.",
  "source": "Original source name",
  "imageUrl": "IMAGE URL from source if provided, otherwise null",
  "wikiSearchQuery": "Wikipedia search query for the article subject. Film/TV: title + year. Music: artist + album. Person only: name + role.",
  "readTimeMinutes": <integer 2–6>,
  "sourceIndex": <the [N] number in the list above>
}

Respond with ONLY a valid JSON array — no markdown, no code fences.`;

  // Run enrichment batches concurrently (max 2 parallel Claude calls).
  // Each batch is 3 articles → independent prompt. Safe under API rate limits.
  const ENRICH_CONCURRENCY = 2;
  console.log(`[shortlist] Enriching ${items.length} selected articles in ${batchCount} batch(es), concurrency=${ENRICH_CONCURRENCY}…`);

  const enrichBatch = async (b: number): Promise<any[]> => {
    const batchItems = items.slice(b * ENRICH_BATCH, (b + 1) * ENRICH_BATCH);
    const offset = b * ENRICH_BATCH;
    const articleList = batchItems
      .map((item, i) =>
        `[${offset + i + 1}] SOURCE: ${item.source}\nDATE: ${item.pubDate}\nTITLE: ${item.title}\nDESCRIPTION: ${item.description || "(none)"}${item.imageUrl ? `\nIMAGE: ${item.imageUrl}` : ""}`
      )
      .join("\n\n---\n\n");

    const raw = await callClaude(makePrompt(articleList, batchItems.length), 10000);
    const arrayStr = extractJsonArray(raw);
    if (!arrayStr) throw new Error(`Enrichment batch ${b + 1}: no JSON array in response`);
    const parsed = JSON.parse(sanitizeClaudeJson(arrayStr));
    for (const p of parsed) {
      p._rawItem = batchItems[(p.sourceIndex - 1) - offset] ?? batchItems[p.sourceIndex - 1];
    }
    return parsed;
  };

  const enriched: any[] = [];
  for (let start = 0; start < batchCount; start += ENRICH_CONCURRENCY) {
    const chunk = Array.from(
      { length: Math.min(ENRICH_CONCURRENCY, batchCount - start) },
      (_, i) => enrichBatch(start + i)
    );
    const results = await Promise.all(chunk);
    for (const r of results) enriched.push(...r);
  }

  // Build EnrichedArticle[]
  const articles: EnrichedArticle[] = await Promise.all(enriched.map(async (item: any, i: number) => {
    const cat = item.category in CATEGORY_GRADIENTS ? item.category : "Internet";
    const [gradientStart, gradientEnd] = CATEGORY_GRADIENTS[cat];
    const rssImageUrl = typeof item.imageUrl === "string" ? item.imageUrl : null;
    let imageUrl: string | null = null;
    if (isGoodImageUrl(rssImageUrl)) {
      const rssDims = await fetchImageDimensions(rssImageUrl!);
      if (!rssDims || rssDims.width >= 400) {
        imageUrl = rssImageUrl!;
        trackImageUrl(imageUrl);
      }
    }
    const rawItem: RawRSSItem | undefined = item._rawItem;

    return {
      id: i + 1,
      title: String(item.title ?? ""),
      summary: String(item.summary ?? ""),
      content: String(item.content ?? ""),
      category: cat,
      source: String(item.source ?? "Unknown"),
      readTimeMinutes: Number(item.readTimeMinutes) || 5,
      publishedAt: (() => {
        if (publishToday) return new Date().toISOString();
        if (rawItem?.pubDate) {
          const d = new Date(rawItem.pubDate);
          if (!isNaN(d.getTime())) return d.toISOString();
        }
        return new Date().toISOString();
      })(),
      likes: Math.floor(Math.random() * 4500) + 500,
      isBookmarked: false,
      gradientStart,
      gradientEnd,
      tag: String(item.tag ?? "FEATURE"),
      link: rawItem?.link ?? null,
      imageUrl: imageUrl ?? `__NEEDS_OG__${rawItem?.link ?? ""}`,
      wikiSearchQuery: typeof item.wikiSearchQuery === "string" ? item.wikiSearchQuery : "",
      keyPoints: Array.isArray(item.keyPoints) ? item.keyPoints : [],
      signalScore: typeof item.signalScore === "number" ? item.signalScore : null,
    } satisfies EnrichedArticle;
  }));

  // Image selection — intent-aware multi-candidate scoring engine (same as main pipeline).
  const ogNeeded = articles.filter((a) => a.imageUrl?.startsWith("__NEEDS_OG__"));
  if (ogNeeded.length > 0) {
    console.log(`[shortlist] Selecting images for ${ogNeeded.length} articles…`);
    await Promise.all(
      ogNeeded.map(async (article, idx) => {
        const articleUrl = (article.imageUrl as string).replace("__NEEDS_OG__", "");
        const result = await selectBestImage(article, articleUrl, null, idx);
        article.imageUrl  = result.url;
        if (result.width)  article.imageWidth  = result.width;
        if (result.height) article.imageHeight = result.height;
        if (result.focalX !== undefined) article.imageFocalX = result.focalX;
        if (result.focalY !== undefined) article.imageFocalY = result.focalY;
        if (result.safeW !== undefined) article.imageSafeW = result.safeW;
        if (result.safeH !== undefined) article.imageSafeH = result.safeH;
      })
    );
  }

  // Fetch pixel dimensions + focal points for first-pass RSS-winner articles.
  await Promise.all(
    articles
      .filter((a) => a.imageUrl && !a.imageUrl.startsWith("__NEEDS_OG__") && !a.imageWidth)
      .map(async (article) => {
        const dims = await fetchImageDimensions(article.imageUrl!);
        if (dims) { article.imageWidth = dims.width; article.imageHeight = dims.height; }
      })
  );
  await Promise.all(
    articles
      .filter((a) => a.imageUrl && !a.imageUrl.startsWith("__NEEDS_OG__") && (a.imageFocalX == null || a.imageSafeW == null))
      .map(async (article) => {
        const focal = await detectImageFocalPoint(article.imageUrl!);
        if (focal) {
          article.imageFocalX = focal.x;
          article.imageFocalY = focal.y;
          article.imageSafeW  = focal.safeW;
          article.imageSafeH  = focal.safeH;
        }
      })
  );

  return articles;
}
