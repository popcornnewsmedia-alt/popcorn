import type { VercelRequest, VercelResponse } from "@vercel/node";

// This file exists only to satisfy Vercel's /api root.
// All real routes live in /api/news/*, /api/categories, etc.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(404).json({ error: "Not found" });
}
