/**
 * Image URL helper — adapts a stored Supabase Storage URL into a viewport-
 * sized variant via Supabase's built-in image transformation endpoint.
 *
 * Why this exists:
 *   The masters in the `article-images` bucket are 2400px wide JPEGs (~700KB
 *   on disk, ~22MB decoded each). Loading 7 cards × 2 imgs each (blur layer
 *   + hero) into an iOS WebView at full size pushes past the ~250-500MB
 *   memory ceiling and OOMs the app. Web is unaffected because desktops
 *   have orders of magnitude more RAM.
 *
 *   This is the same trick Instagram/TikTok use: keep one master server-
 *   side, serve adaptively-sized variants per-device. We never download
 *   pixels we won't display.
 *
 * Endpoint:
 *   /storage/v1/render/image/public/<bucket>/<path>?width=W&quality=Q&resize=contain
 *
 * Returns the original URL unchanged if:
 *   - URL is null/undefined/empty
 *   - URL isn't a Supabase Storage public URL (e.g. a raw Wikipedia URL)
 *   - URL already uses /render/image/ (idempotent)
 */

const SUPABASE_OBJECT_PATH = "/storage/v1/object/public/";
const SUPABASE_RENDER_PATH = "/storage/v1/render/image/public/";

export interface ImageVariantOpts {
  /** Target width in CSS pixels. The CDN downscales the master to this width. */
  width: number;
  /** JPEG quality 0-100. Default 80 (Instagram-grade). */
  quality?: number;
}

/**
 * Rewrites a Supabase Storage public URL to use the on-the-fly resize
 * endpoint. Non-Supabase URLs pass through unchanged so callers don't
 * have to care about the source.
 */
export function imageVariant(url: string | null | undefined, opts: ImageVariantOpts): string {
  if (!url) return "";

  // Already transformed — don't double-rewrite.
  if (url.includes(SUPABASE_RENDER_PATH)) return url;

  // Only rewrite Supabase Storage public URLs. Wikipedia, Unsplash, etc.
  // pass through unchanged (they have their own CDNs / can't be transformed).
  const objectIdx = url.indexOf(SUPABASE_OBJECT_PATH);
  if (objectIdx === -1) return url;

  const base = url.slice(0, objectIdx) + SUPABASE_RENDER_PATH + url.slice(objectIdx + SUPABASE_OBJECT_PATH.length);
  const quality = opts.quality ?? 80;

  // resize=contain ensures the long edge ≤ width without cropping; preserves
  // aspect ratio. (resize=cover would crop to a square — not what we want for
  // editorial photos.)
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}width=${opts.width}&quality=${quality}&resize=contain`;
}

/**
 * Feed-card variant: 1440px wide @ q85.
 *   - iPhone 16 Pro Max is 1290 DEVICE px wide (430pt @3x); the full-bleed
 *     plate plus the parallax wrapper's scale(1.05) needs ~1355 device px.
 *     1440 keeps the hero at/above 1:1 so the GPU never upscales it.
 *     (The previous 1080 was ~25% under device resolution — visibly soft.)
 *   - q85 sits below the visible-artifact threshold (q80 showed banding on
 *     skin/gradients from the double encode: master q95 → variant).
 *   - Decoded size ≈ 1440 × 1730 × 4 bytes ≈ 10MB (vs 22MB for 2400px
 *     master). ~7 mounted heroes ≈ 70MB — inside the WebView budget that
 *     originally motivated sizing variants.
 */
export function feedImageUrl(url: string | null | undefined): string {
  return imageVariant(url, { width: 1440, quality: 85 });
}

/**
 * Article-reader variant: 1600px wide @ q85.
 *   - The reader hero is closer to full-bleed and may be viewed more carefully.
 *   - Slightly higher quality buffer than feed without paying full master cost.
 *   - Decoded size ≈ 1600 × 1900 × 4 bytes ≈ 12MB (vs 22MB master).
 */
export function readerImageUrl(url: string | null | undefined): string {
  return imageVariant(url, { width: 1600, quality: 85 });
}

/**
 * Probe variant for the dominantColor canvas extraction in ArticleCard.
 * 16px target — we only sample 16x16 pixels anyway. Massive bandwidth and
 * decode-time win for the colour-probe code path.
 */
export function probeImageUrl(url: string | null | undefined): string {
  return imageVariant(url, { width: 64, quality: 70 });
}
