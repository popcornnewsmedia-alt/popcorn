/**
 * APNs sender — HTTP/2 token-auth push to Apple Push Notification service.
 *
 * Configuration via env vars (all required for live sending; if any are missing
 * the sender returns null/stubbed results so dev environments still boot):
 *   APNS_AUTH_KEY  — full contents of the .p8 file (BEGIN/END PRIVATE KEY block)
 *   APNS_KEY_ID    — 10-char key id from the Apple Developer console
 *   APNS_TEAM_ID   — 10-char team id from the Apple Developer console
 *   APNS_BUNDLE_ID — e.g. org.popcornmedia.app
 *   APNS_ENV       — "production" (release) or "development" (TestFlight sandbox)
 */
import apn from "@parse/node-apn";

const FEED_READY_TITLE = "Your Popcorn is ready";
const FEED_READY_BODY  = "Today's feed just dropped — tap to pop in.";
const BANNER_IMAGE_URL =
  process.env.APNS_BANNER_IMAGE_URL ??
  "https://www.popcornmedia.org/push/popcorn-banner.png";

let _provider: apn.Provider | null = null;
let _checkedEnv = false;

function getProvider(): apn.Provider | null {
  if (_checkedEnv) return _provider;
  _checkedEnv = true;

  const key     = process.env.APNS_AUTH_KEY;
  const keyId   = process.env.APNS_KEY_ID;
  const teamId  = process.env.APNS_TEAM_ID;
  const env     = (process.env.APNS_ENV ?? "production").toLowerCase();

  if (!key || !keyId || !teamId) {
    console.warn(
      "[apns] APNS_AUTH_KEY / APNS_KEY_ID / APNS_TEAM_ID not set — push sender disabled (stub mode).",
    );
    _provider = null;
    return null;
  }

  _provider = new apn.Provider({
    token: {
      key: key.replace(/\\n/g, "\n"), // tolerate \n escapes in env vars
      keyId,
      teamId,
    },
    production: env === "production",
  });
  console.log(`[apns] provider ready (env=${env})`);
  return _provider;
}

export interface SendResult {
  sent: number;
  invalidTokens: string[];
  errors: Array<{ token: string; reason: string }>;
  apnsIds: Record<string, string>; // token -> apns-id header
}

export interface SendFeedReadyParams {
  deviceTokens: string[];
  feedDate: string;
}

/**
 * Send the "Your Popcorn is ready" alert to a batch of device tokens.
 * Returns:
 *   sent           — count successfully delivered to APNs
 *   invalidTokens  — tokens that returned Unregistered / BadDeviceToken (prune these)
 *   errors         — non-fatal per-token errors
 *   apnsIds        — apns-id header per delivered token (for tracing)
 *
 * If env vars are missing the function returns { sent: 0, ... } and logs a stub
 * line — useful in dev / pre-APNs-setup.
 */
export async function sendFeedReady(
  { deviceTokens, feedDate }: SendFeedReadyParams,
): Promise<SendResult> {
  const result: SendResult = { sent: 0, invalidTokens: [], errors: [], apnsIds: {} };
  if (!deviceTokens.length) return result;

  const provider = getProvider();
  const bundleId = process.env.APNS_BUNDLE_ID;
  if (!provider || !bundleId) {
    console.log(`[apns/stub] would send feed-ready to ${deviceTokens.length} device(s) for ${feedDate}`);
    return result;
  }

  const note = new apn.Notification();
  note.topic            = bundleId;
  note.alert            = { title: FEED_READY_TITLE, body: FEED_READY_BODY };
  note.sound            = "default";
  note.mutableContent   = true;       // triggers Notification Service Extension for the image
  note.pushType         = "alert";
  note.payload          = {
    kind:     "feed-ready",
    feedDate,
    deepLink: "popcorn://feed-ready",
    imageUrl: BANNER_IMAGE_URL,
  };

  const response = await provider.send(note, deviceTokens);

  for (const ok of response.sent) {
    result.sent += 1;
    // node-apn 8.x: sent items can carry an `apns-id` on the response, but the
    // public type only exposes `device`. Try to read it defensively.
    const apnsId = (ok as unknown as { apnsId?: string; "apns-id"?: string }).apnsId
      ?? (ok as unknown as { apnsId?: string; "apns-id"?: string })["apns-id"];
    if (apnsId) result.apnsIds[ok.device] = apnsId;
  }

  for (const fail of response.failed) {
    const token  = fail.device;
    const reason =
      (fail.response as { reason?: string } | undefined)?.reason
      ?? fail.error?.message
      ?? (fail.status ? `status ${fail.status}` : "unknown");

    if (reason === "Unregistered" || reason === "BadDeviceToken") {
      result.invalidTokens.push(token);
    } else {
      result.errors.push({ token, reason });
    }
  }

  return result;
}

/** Shut down the underlying HTTP/2 session. Call from process-level shutdown hooks. */
export function shutdownApns(): void {
  if (_provider) {
    _provider.shutdown();
    _provider = null;
    _checkedEnv = false;
  }
}
