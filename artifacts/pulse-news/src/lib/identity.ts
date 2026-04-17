import type { User } from "@supabase/supabase-js";

// Derive the display name + handle + initials to snapshot into a new comment row.
// Insert-time snapshot keeps rendering cheap (no auth lookup per row).
//
// - `name`    → full_name style, used for greetings and welcome copy.
// - `handle`  → '@username' when a profile row exists, else falls back to `name`.
// - `initials`→ first one-or-two letters of `name`, for avatar circles.
export function deriveIdentity(
  user: User,
  username?: string | null,
): { name: string; handle: string; initials: string } {
  const rawName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Anonymous";
  const name = rawName.trim() || "Anonymous";
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = (
    parts.length === 1
      ? parts[0].slice(0, 2)
      : parts.slice(0, 2).map(p => p[0]).join("")
  ).toUpperCase();
  const handle = username ? `@${username}` : name;
  return { name, handle, initials: initials || "?" };
}

// Coarse relative-time formatter (matches the feel of the original seed-data
// strings like "3m ago" / "1h ago" / "2d ago" / "just now").
export function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (diffSec < 45) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWk = Math.round(diffDay / 7);
  if (diffWk < 5) return `${diffWk}w ago`;
  const diffMo = Math.round(diffDay / 30);
  if (diffMo < 12) return `${diffMo}mo ago`;
  const diffYr = Math.round(diffDay / 365);
  return `${diffYr}y ago`;
}
