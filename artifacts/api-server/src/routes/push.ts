/**
 * Push-notification device registry + manual-test endpoints.
 *
 *   POST   /api/push/register   — body { deviceToken, apnsEnv? }, auth: Bearer <supabase access token>
 *                                  upserts push_devices, returns { ok: true }
 *   DELETE /api/push/register   — body { deviceToken }, auth: Bearer <token>
 *                                  removes the row (sign-out / disable)
 *   POST   /api/push/test       — body { feedDate?, userId? }, auth: Bearer <token> (dev only)
 *                                  sends one banner to a single user (current user if userId omitted).
 *                                  gated behind NODE_ENV !== "production".
 */
import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase-client.js";
import { broadcastFeedReadyToUser } from "../lib/push-broadcast.js";

const router = Router();

async function resolveUserFromAuthHeader(req: Request): Promise<string | null> {
  const header = req.header("authorization") ?? req.header("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

router.post("/push/register", async (req: Request, res: Response) => {
  try {
    const userId = await resolveUserFromAuthHeader(req);
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const { deviceToken, apnsEnv } = (req.body ?? {}) as { deviceToken?: string; apnsEnv?: string };
    const token = (deviceToken ?? "").toString().trim();
    if (!token || !/^[0-9a-fA-F]{32,256}$/.test(token)) {
      return res.status(400).json({ ok: false, error: "Invalid deviceToken" });
    }
    const env = (apnsEnv ?? "production").toLowerCase();
    if (env !== "production" && env !== "development") {
      return res.status(400).json({ ok: false, error: "apnsEnv must be 'production' or 'development'" });
    }

    const { error } = await supabase
      .from("push_devices")
      .upsert(
        {
          user_id:      userId,
          device_token: token,
          platform:     "ios",
          apns_env:     env,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_token" },
      );
    if (error) {
      console.error("[push/register] upsert failed:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("[push/register] error:", (err as Error).message);
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.delete("/push/register", async (req: Request, res: Response) => {
  try {
    const userId = await resolveUserFromAuthHeader(req);
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const { deviceToken } = (req.body ?? {}) as { deviceToken?: string };
    const token = (deviceToken ?? "").toString().trim();
    if (!token) return res.status(400).json({ ok: false, error: "Missing deviceToken" });

    const { error } = await supabase
      .from("push_devices")
      .delete()
      .eq("user_id", userId)
      .eq("device_token", token);
    if (error) {
      console.error("[push/register DELETE] failed:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("[push/register DELETE] error:", (err as Error).message);
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/push/test", async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ ok: false, error: "Not found" });
    }
    const callerId = await resolveUserFromAuthHeader(req);
    if (!callerId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const body = (req.body ?? {}) as { feedDate?: string; userId?: string };
    const feedDate = (body.feedDate ?? new Date().toISOString().slice(0, 10)).trim();
    const targetUser = (body.userId ?? callerId).toString().trim();

    const summary = await broadcastFeedReadyToUser(targetUser, feedDate);
    return res.json({ ok: true, feedDate, targetUser, ...summary });
  } catch (err) {
    console.error("[push/test] error:", (err as Error).message);
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

export default router;
