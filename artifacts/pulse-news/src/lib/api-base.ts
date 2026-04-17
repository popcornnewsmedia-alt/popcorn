// Resolve the base URL for hitting our API.
//
// In production the app and the Vercel serverless functions share an origin,
// so we use a RELATIVE URL ("" + "/api/…"). This avoids the CORS preflight
// hazard where a mismatched VITE_API_URL (e.g. apex vs. www) would get a 307
// cross-origin redirect that browsers refuse to follow during preflight —
// which surfaced to users as "Couldn't check availability".
//
// In dev the Vite server on :5173 and the API server on :3001 are different
// origins, so we fall back to VITE_API_URL from .env.local.
export function apiBase(): string {
  if (import.meta.env.PROD) return "";
  return import.meta.env.VITE_API_URL ?? "";
}
