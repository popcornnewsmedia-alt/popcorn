/**
 * EXPERIMENT — AI-generated editorial images for 5 May-14 articles.
 *
 * Standalone, NOT wired into the curation pipeline. Generates one
 * gpt-image-1 image per article, uploads it to the Supabase
 * `article-images` bucket under `ai-experiments/`, then swaps it into
 * the live feed via Railway's PATCH /api/curation/set-image (which runs
 * the Sharp pipeline + focal detection like any other manual image fix).
 *
 * Usage:
 *   cd artifacts/api-server
 *   node --env-file=../../.env scripts/experiment-ai-images.ts
 *
 * Outputs:
 *   - PNGs saved to /tmp/popcorn-ai-experiments/
 *   - Summary table with per-image cost + grand total
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
const SIZE = "1024x1536";   // portrait, ~2:3 — closest to iPhone aspect
const QUALITY = "high";     // editorial-tier
const OUTPUT_DIR = "/tmp/popcorn-ai-experiments";

// gpt-image-1 token pricing ($ per 1M tokens)
const PRICE_TEXT_INPUT = 5;
const PRICE_IMAGE_OUTPUT = 40;

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env: OPENAI_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Style template (sent on every call) ────────────────────────────────────

const STYLE_TEMPLATE = `
STYLE — Popcorn Editorial (Verge-inspired magazine cover)

LOOK:
- Bold solid color background OR a single textured backdrop (binary-code
  pattern, marbled paint swirls, isometric grid, halftone dots, gritty
  paper texture). Pick ONE — never both.
- Photoreal B&W or duotone subject cutouts collaged onto graphic
  backgrounds. Optional colored glow halo around the cutout.
- Mix design + photoreal — most images are collage; occasional pure
  photoreal scene is OK when the story is a real moment.

COLOR PALETTE:
- Editorial, not neon. Magazine-print vivid, never gaudy.
- Use muted-vivid tones: dusty oxblood, burnt orange, sage, mustard,
  deep teal, bruised plum, slate blue, cream, charcoal. Saturated but
  matte, like CMYK ink on uncoated paper.
- Avoid candy fluorescents, pure RGB primaries, neon gradients, Canva
  aesthetic.
- Each image in this batch uses a distinctly different dominant hue.

COMPOSITION:
- Portrait 1024×1536, full bleed.
- ONE dominant focal element. Confident negative space.

TONE:
- Sophisticated, slightly playful, intellectually serious — feature-
  story energy from The Verge / The Atlantic / NY Mag.
- Capture the IDEA, not a literal inventory of headline keywords.

RULES:
- NO headline text, captions, or watermarks anywhere in the image.
- Logos OK when the story is fundamentally about that company. One logo
  max, integrated cleanly — never pasted on as a sticker.
- If the article is about a real, named person, feature THAT person as a
  recognizable photoreal cutout. Otherwise no human faces.
- Never stack 3+ symbols from the headline. One strong metaphor only.
- Avoid cliché tech imagery and generic stock aesthetic.

SUBJECT:
`.trim();

// ─── Article briefs ─────────────────────────────────────────────────────────

interface ArticleBrief {
  id: number;
  slug: string;
  subject: string;
}

const ARTICLES: ArticleBrief[] = [
  {
    id: 1457,
    slug: "world-cup-halftime",
    subject:
      "Three photoreal black-and-white cutouts of Madonna, Shakira, and BTS members, performing-energy poses, collaged onto a dusty oxblood-and-mustard marbled texture evoking a vintage stadium poster. One small soccer-ball motif tucked into the negative space. Festival energy without literal stage props.",
  },
  {
    id: 1456,
    slug: "altman-liar",
    subject:
      "Sam Altman as a sharp photoreal black-and-white portrait cutout, slight low angle, on a muted sage-green flat field with a faint etched question-mark form integrated into the texture. Cold interrogation tone, single dominant subject, no other props.",
  },
  {
    id: 1455,
    slug: "florence-pugh-eden",
    subject:
      "Florence Pugh as a contemplative photoreal black-and-white portrait cutout on a dusty burnt-sienna canvas texture evoking sun-bleached early-20th-century California farmland. Cinematic, literary, period-piece tone. No other figures or props.",
  },
  {
    id: 1428,
    slug: "claude-bitcoin",
    subject:
      "A single bronze cracked padlock as the dramatic focal subject, lit from one side, photoreal, on a deep slate-blue field with a faint thin-line schematic pattern in the background. A subtle Anthropic Claude orange-cream mark may appear small and integrated if it fits cleanly. No coins, no AI brain imagery.",
  },
  {
    id: 1422,
    slug: "ubisoft-black-flag",
    subject:
      "A single weathered treasure chest half-buried in Caribbean sand, photoreal close-up, on a deep teal flat background with a torn parchment-map texture peeking from one corner. A small Ubisoft logo may be subtly integrated into the parchment if it fits cleanly. No pirates, no game UI.",
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
  return { b64, usage: json.usage ?? { total_tokens: 0, input_tokens: 0, output_tokens: 0 } };
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
    publicUrl: string;
    processedUrl: string;
    error?: string;
  }> = [];

  let totalCost = 0;

  for (const a of ARTICLES) {
    console.log(`\n──── ${a.id} ${a.slug} ────`);
    const prompt = `${STYLE_TEMPLATE}\n${a.subject}`;

    try {
      console.log(`[1/3] Generating image...`);
      const t0 = Date.now();
      const gen = await generateImage(prompt);
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      const cost = costUSD(gen.usage);
      totalCost += cost;
      console.log(
        `      done in ${dt}s — usage in=${gen.usage.input_tokens} out=${gen.usage.output_tokens} → $${cost.toFixed(4)}`
      );

      const buf = Buffer.from(gen.b64, "base64");
      const localPath = path.join(OUTPUT_DIR, `${a.id}-${a.slug}.png`);
      fs.writeFileSync(localPath, buf);
      console.log(`      saved local: ${localPath} (${(buf.length / 1024).toFixed(0)} KB)`);

      console.log(`[2/3] Uploading to Supabase bucket...`);
      const bucketKey = `ai-experiments/2026-05-14/${a.id}-${a.slug}.png`;
      const publicUrl = await uploadToBucket(buf, bucketKey);
      console.log(`      uploaded: ${publicUrl}`);

      console.log(`[3/3] Swapping into article ${a.id} via Railway set-image...`);
      const swap = (await setImageOnArticle(a.id, publicUrl)) as { image?: { url?: string } };
      const processedUrl = swap.image?.url ?? "(unknown)";
      console.log(`      processed url: ${processedUrl}`);

      results.push({ id: a.id, slug: a.slug, cost, publicUrl, processedUrl });
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`      ✗ ${msg}`);
      results.push({ id: a.id, slug: a.slug, cost: 0, publicUrl: "", processedUrl: "", error: msg });
    }
  }

  console.log("\n\n═══════════ SUMMARY ═══════════");
  for (const r of results) {
    if (r.error) {
      console.log(`  ✗ ${r.id} ${r.slug.padEnd(22)} ERROR: ${r.error.slice(0, 60)}`);
    } else {
      console.log(`  ✓ ${r.id} ${r.slug.padEnd(22)} $${r.cost.toFixed(4)}`);
    }
  }
  console.log(`\nTotal cost: $${totalCost.toFixed(4)}`);
  console.log(`Avg per image: $${(totalCost / Math.max(1, results.filter((r) => !r.error).length)).toFixed(4)}`);
  console.log(`Output dir: ${OUTPUT_DIR}`);
})();
