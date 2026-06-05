/**
 * EXPERIMENT v2 — AI-generated editorial images for 5 more May-14 articles.
 *
 * Differences from v1:
 *   - Looser COLOR PALETTE prompt (editorial discipline + inspirations,
 *     no exclusion list).
 *   - Looser LOOK section (no forced "solid OR textured" rule — the model
 *     picks the composition itself, guided by editorial inspirations).
 *   - NO per-article subject brief — the only article-specific input is
 *     the raw headline. Tests whether the style template alone produces
 *     publication-ready images without manual creative direction.
 *
 * Usage:
 *   cd artifacts/api-server
 *   node --env-file=../../.env scripts/experiment-ai-images-v2.ts
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// ─── Config ─────────────────────────────────────────────────────────────────

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RAILWAY_URL =
  "https://workspaceapi-server-production-d088.up.railway.app";

const MODEL = "gpt-image-1";
const SIZE = "1024x1536";
const QUALITY = "high";
const OUTPUT_DIR = "/tmp/popcorn-ai-experiments-v2";

const PRICE_TEXT_INPUT = 5;
const PRICE_IMAGE_OUTPUT = 40;

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env: OPENAI_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Style template v2 (loosened) ───────────────────────────────────────────

const STYLE_TEMPLATE = `
STYLE — Popcorn Editorial

You are creating a magazine-cover-quality editorial image for a culture
news app. Aim for the visual language of feature stories in The Verge,
The Atlantic, New York Magazine, and Bloomberg Businessweek covers.

LOOK & FEEL:
- Editorial, considered, art-directed. Reads as a piece of design, not
  a stock photo or a generic illustration.
- You can choose freely between approaches inspired by editorial
  publications: photoreal collage with cut-out subjects, conceptual
  illustration, photoreal scene with strong art direction, mixed-media
  treatment, painterly portraiture — whatever serves the story best.
- Backgrounds can be solid color, textured, patterned, gradient,
  painterly, or photographic — pick what fits the story's mood.
- If you use photoreal subjects, treat them with intent — duotone,
  desaturated, isolated against a graphic ground, dramatic lighting.

COLOR:
- Editorial color discipline. Think CMYK print, magazine cover, gallery
  poster, art-house movie still. Confident, considered palettes.
- Across this batch of images, vary the dominant color significantly —
  no two images should feel like they share the same wash.

COMPOSITION:
- Portrait 1024×1536, full bleed.
- One dominant focal element. Confident negative space.

TONE:
- Sophisticated, slightly playful, intellectually serious. Capture the
  spirit and idea of the headline — never a literal inventory of its
  keywords.

RULES:
- NO headline text, captions, or watermarks anywhere in the image.
- Logos are OK only when the story is fundamentally about that company,
  and only one logo, integrated cleanly.
- If the article is about a real, named person, depict THAT person
  recognizably. Otherwise no human faces.
- One strong metaphor or focal subject — never a busy collage of every
  noun in the headline.

HEADLINE:
`.trim();

// ─── Articles (headline only — no brief) ────────────────────────────────────

interface Article {
  id: number;
  slug: string;
  headline: string;
}

const ARTICLES: Article[] = [
  {
    id: 1447,
    slug: "musk-nolan-lupita",
    headline:
      "Musk Says Nolan Cast Lupita Nyong'o as Helen of Troy to Win Awards",
  },
  {
    id: 1454,
    slug: "westminster-netflix",
    headline: "Westminster Dog Show Leaves Fox for Netflix in 2027",
  },
  {
    id: 1446,
    slug: "foo-fighters-tiny-desk",
    headline:
      "Foo Fighters Play Their First-Ever Tiny Desk With Everlong and My Hero",
  },
  {
    id: 1436,
    slug: "youtube-brandcast",
    headline:
      "YouTube Brandcast: Chappell Roan and Zara Larsson Close a Big Night",
  },
  {
    id: 1439,
    slug: "monetised-bride",
    headline:
      "Wedding Content Is Now a Brand Deal. Meet the Monetised Bride.",
  },
];

// ─── OpenAI image generation ────────────────────────────────────────────────

interface ImageGenResult {
  b64: string;
  usage: {
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    input_tokens_details?: { text_tokens?: number; image_tokens?: number };
  };
}

async function generateImage(prompt: string): Promise<ImageGenResult> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      size: SIZE,
      quality: QUALITY,
      n: 1,
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 400)}`);
  }
  const json = JSON.parse(body);
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`No b64_json in response: ${body.slice(0, 200)}`);
  return {
    b64,
    usage: json.usage ?? { total_tokens: 0, input_tokens: 0, output_tokens: 0 },
  };
}

// ─── Supabase upload ────────────────────────────────────────────────────────

async function uploadToBucket(buf: Buffer, key: string): Promise<string> {
  const { error } = await supabase.storage
    .from("article-images")
    .upload(key, buf, {
      contentType: "image/png",
      upsert: true,
      cacheControl: "31536000",
    });
  if (error) throw new Error(`Bucket upload failed: ${error.message}`);
  const { data } = supabase.storage.from("article-images").getPublicUrl(key);
  return data.publicUrl;
}

// ─── Railway set-image ──────────────────────────────────────────────────────

async function setImageOnArticle(id: number, imageUrl: string): Promise<unknown> {
  const res = await fetch(`${RAILWAY_URL}/api/curation/set-image`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, imageUrl }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`set-image ${res.status}: ${body.slice(0, 400)}`);
  return JSON.parse(body);
}

// ─── Cost calculation ──────────────────────────────────────────────────────

function costUSD(usage: ImageGenResult["usage"]): number {
  const textIn = (usage.input_tokens_details?.text_tokens ?? usage.input_tokens) || 0;
  const imageIn = usage.input_tokens_details?.image_tokens ?? 0;
  const out = usage.output_tokens || 0;
  return (
    (textIn * PRICE_TEXT_INPUT) / 1_000_000 +
    (imageIn * 10) / 1_000_000 +
    (out * PRICE_IMAGE_OUTPUT) / 1_000_000
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const results: Array<{
    id: number;
    slug: string;
    cost: number;
    error?: string;
  }> = [];

  let totalCost = 0;

  for (const a of ARTICLES) {
    console.log(`\n──── ${a.id} ${a.slug} ────`);
    const prompt = `${STYLE_TEMPLATE}\n${a.headline}`;

    try {
      console.log(`[1/3] Generating image...`);
      const t0 = Date.now();
      const gen = await generateImage(prompt);
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      const cost = costUSD(gen.usage);
      totalCost += cost;
      console.log(
        `      done in ${dt}s — in=${gen.usage.input_tokens} out=${gen.usage.output_tokens} → $${cost.toFixed(4)}`
      );

      const buf = Buffer.from(gen.b64, "base64");
      const localPath = path.join(OUTPUT_DIR, `${a.id}-${a.slug}.png`);
      fs.writeFileSync(localPath, buf);
      console.log(`      saved local: ${localPath} (${(buf.length / 1024).toFixed(0)} KB)`);

      console.log(`[2/3] Uploading to Supabase bucket...`);
      const bucketKey = `ai-experiments/v2/2026-05-14/${a.id}-${a.slug}.png`;
      const publicUrl = await uploadToBucket(buf, bucketKey);
      console.log(`      uploaded: ${publicUrl}`);

      console.log(`[3/3] Swapping into article ${a.id}...`);
      const swap = (await setImageOnArticle(a.id, publicUrl)) as { image?: { url?: string } };
      console.log(`      processed: ${swap.image?.url ?? "(unknown)"}`);

      results.push({ id: a.id, slug: a.slug, cost });
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`      ✗ ${msg}`);
      results.push({ id: a.id, slug: a.slug, cost: 0, error: msg });
    }
  }

  console.log("\n\n═══════════ SUMMARY (v2) ═══════════");
  for (const r of results) {
    if (r.error) {
      console.log(`  ✗ ${r.id} ${r.slug.padEnd(22)} ERROR: ${r.error.slice(0, 60)}`);
    } else {
      console.log(`  ✓ ${r.id} ${r.slug.padEnd(22)} $${r.cost.toFixed(4)}`);
    }
  }
  console.log(`\nTotal cost: $${totalCost.toFixed(4)}`);
  console.log(`Output dir: ${OUTPUT_DIR}`);
})();
