import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, mapRow } from "../_lib/supabase";

const SITE_ORIGIN = "https://popcornmedia.org";

/** Escapes a string for safe insertion into an HTML attribute / text node. */
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Serves the SPA shell for /a/:id with per-article Open Graph / Twitter meta
 * injected into <head>. Crawlers (iMessage, WhatsApp, Slack, Twitter, …) read
 * the tags to render a rich link card; real browsers still get the full app,
 * which routes to the article on load.
 *
 * Wired via a vercel.json rewrite: /a/:id -> /api/share/:id (URL stays /a/:id).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = Number(req.query.id);
  const host = (req.headers.host as string) || "popcornmedia.org";

  // Fetch the built SPA shell so humans still get the working app. The shell is
  // a static asset behind the catch-all rewrite, so this never re-enters us.
  let shell: string;
  try {
    shell = await fetch(`https://${host}/index.html`).then((r) => r.text());
  } catch {
    // If we can't read the shell, fall back to a redirect so the link still works.
    res.setHeader("Location", `${SITE_ORIGIN}/`);
    return res.status(302).end();
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  // Look up the article. On any miss, serve the unmodified shell — the SPA's
  // /a/:id route will show its own "story not found" state.
  let article: ReturnType<typeof mapRow> | null = null;
  if (id) {
    const { data } = await supabase
      .from("articles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (data) article = mapRow(data);
  }

  if (!article) {
    res.setHeader("Cache-Control", "s-maxage=60");
    return res.status(200).send(shell);
  }

  const url = `${SITE_ORIGIN}/a/${article.id}`;
  const title = esc(article.title);
  const desc = esc(article.summary);
  const image = article.imageUrl ? esc(article.imageUrl) : "";

  const tags = [
    `<title>${title} · Popcorn</title>`,
    `<meta name="description" content="${desc}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="Popcorn" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    `<meta property="og:url" content="${url}" />`,
    image ? `<meta property="og:image" content="${image}" />` : "",
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${desc}" />`,
    image ? `<meta name="twitter:image" content="${image}" />` : "",
  ].filter(Boolean).join("\n    ");

  // Drop the static <title> from the shell (we inject our own) and append the
  // per-article tags just before </head>.
  const html = shell
    .replace(/<title>.*?<\/title>/i, "")
    .replace(/<\/head>/i, `    ${tags}\n  </head>`);

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=86400");
  res.status(200).send(html);
}
