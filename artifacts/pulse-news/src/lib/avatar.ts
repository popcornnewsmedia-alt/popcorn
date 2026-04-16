// Shared avatar palette + helpers for comments / notifications / composer.

export const BRAND = "#053980";
export const CREAM = "#fff1cd";

// Quiet variations within the blue family. Used to colour commenter avatars.
const AVATAR_BLUES = ["#053980", "#0c4a98", "#042a62", "#1d5aa6"];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_BLUES[Math.abs(hash) % AVATAR_BLUES.length];
}

// The "current user" stub used in the composer when a real identity isn't
// required (e.g. the avatar shown while composing — actual author fields are
// snapshotted from Supabase auth at insert time via deriveIdentity).
export const YOU = { author: "You", initials: "Y", color: BRAND };
