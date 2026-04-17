import { apiBase } from "./api-base";

// Username validation + availability helpers.
//
// Client-side mirror of the SQL constraints in
// `supabase/migrations/20260417_add_profiles.sql`. The server always has the
// final say (via the `username_available` RPC); this file just keeps the
// signup UI snappy without a round-trip per keystroke.

export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export const RESERVED = new Set<string>([
  "admin", "popcorn", "root", "api", "support", "system", "null", "undefined",
  "moderator", "staff", "help", "about", "terms", "privacy", "login", "signup",
]);

export type FormatReason = "too_short" | "too_long" | "bad_chars" | "reserved";

export type FormatResult =
  | { ok: true }
  | { ok: false; reason: FormatReason };

/** Validate format client-side. Server will revalidate. */
export function validateUsernameFormat(raw: string): FormatResult {
  const u = raw.trim().toLowerCase();
  if (u.length < 3) return { ok: false, reason: "too_short" };
  if (u.length > 20) return { ok: false, reason: "too_long" };
  if (!/^[a-z0-9_]+$/.test(u)) return { ok: false, reason: "bad_chars" };
  if (RESERVED.has(u)) return { ok: false, reason: "reserved" };
  return { ok: true };
}

/** Sanitize a display-name seed into a username candidate. */
export function seedUsername(seed: string): string {
  return (seed || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}

export type AvailabilityReason = "format" | "reserved" | "taken" | "network";

export type AvailabilityResult =
  | { available: true }
  | { available: false; reason: AvailabilityReason };

/** POST to /api/auth/check (kind: "username") and return a typed result. */
export async function checkAvailability(username: string): Promise<AvailabilityResult> {
  const candidate = username.trim().toLowerCase();
  const format = validateUsernameFormat(candidate);
  if (!format.ok) {
    return {
      available: false,
      reason: format.reason === "reserved" ? "reserved" : "format",
    };
  }

  try {
    const resp = await fetch(`${apiBase()}/api/auth/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "username", value: candidate }),
    });
    if (!resp.ok) return { available: false, reason: "network" };
    const json = (await resp.json()) as {
      available: boolean;
      reason?: AvailabilityReason;
    };
    if (json.available) return { available: true };
    return { available: false, reason: json.reason ?? "taken" };
  } catch {
    return { available: false, reason: "network" };
  }
}
