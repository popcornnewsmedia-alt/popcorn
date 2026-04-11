import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../../_lib/supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  res.setHeader("Access-Control-Allow-Origin", "*");

  const id = Number(req.query.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });

  const { data, error } = await supabase
    .from("articles")
    .select("likes")
    .eq("id", id)
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({ id, likes: (data?.likes ?? 0) + 1 });
}
