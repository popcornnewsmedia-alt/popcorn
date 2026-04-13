import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Returns true when running in Vercel production (main branch → popcornmedia.org). */
export function isProd(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/** ISO date string for 7 days ago — used to filter the rolling feed window. */
export function sevenDaysAgo(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/** Maps a raw Supabase articles row to the shape the frontend expects. */
export const mapRow = (row: Record<string, unknown>) => ({
  id:              row.id,
  title:           row.title,
  summary:         row.summary,
  content:         row.content,
  category:        row.category,
  source:          row.source,
  readTimeMinutes: row.read_time_minutes,
  publishedAt:     row.published_at,
  likes:           (row.likes as number) ?? 0,
  isBookmarked:    false,
  gradientStart:   row.gradient_start,
  gradientEnd:     row.gradient_end,
  tag:             row.tag,
  imageUrl:        row.image_url    ?? null,
  imageWidth:      row.image_width  ?? null,
  imageHeight:     row.image_height ?? null,
  imageFocalX:     row.image_focal_x ?? null,
  imageFocalY:     row.image_focal_y ?? null,
  imageSafeW:      row.image_safe_w  ?? null,
  imageSafeH:      row.image_safe_h  ?? null,
  keyPoints:       row.key_points    ?? null,
  signalScore:     row.signal_score  ?? null,
  impact:          row.impact        ?? null,
  feedDate:        row.feed_date     ?? null,
});
