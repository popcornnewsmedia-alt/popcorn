import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Bookmarks are tracked client-side only — this is a no-op stub.
  res.json({ id: Number(req.query.id), isBookmarked: true });
}
