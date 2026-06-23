/**
 * setupPushNotifications — wires the @capacitor/push-notifications plugin into
 * the app on iOS native builds. Safe to call on web (no-op).
 *
 * Call once right after the user signs in. The plugin is idempotent, so a
 * second call just silently re-registers (which covers APNs token rotation).
 *
 * Pipeline:
 *   1. Check Capacitor isNativePlatform.
 *   2. Check current notification permissions; prompt if undecided.
 *   3. On 'granted', call PushNotifications.register() — kicks off APNs.
 *   4. On 'registration', POST the APNs token to /api/push/register on the
 *      api-server (Railway). The Vercel-served www.popcornmedia.org origin
 *      does NOT host /api/push/*; only Railway does.
 *   5. On 'pushNotificationReceived' (foreground), set the feed-ready flag
 *      so the in-app overlay plays.
 *   6. On 'pushNotificationActionPerformed' (banner tap), set the flag and
 *      navigate to the home route.
 */
import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type Token,
  type PushNotificationSchema,
  type ActionPerformed,
} from "@capacitor/push-notifications";
import { flagFeedReady } from "./feed-ready-flag";

/**
 * Railway origin for the api-server. Vercel only proxies /api/news, so push
 * device-registration must go directly to Railway.
 *
 * Override at build time with VITE_PUSH_API_URL if Railway redeploys to a new
 * subdomain.
 */
const PUSH_API_BASE =
  (import.meta.env.VITE_PUSH_API_URL as string | undefined)?.trim() ||
  "https://workspaceapi-server-production-d088.up.railway.app";

const APNS_ENV =
  ((import.meta.env.VITE_APNS_ENV as string | undefined)?.trim().toLowerCase() === "development")
    ? "development"
    : "production";

let _listenersAttached = false;

function attachListenersOnce(getAccessToken: () => Promise<string | null>) {
  if (_listenersAttached) return;
  _listenersAttached = true;

  PushNotifications.addListener("registration", async (token: Token) => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        console.warn("[push] no supabase access token — skipping register call");
        return;
      }
      const res = await fetch(`${PUSH_API_BASE}/api/push/register`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ deviceToken: token.value, apnsEnv: APNS_ENV }),
      });
      if (!res.ok) {
        console.warn("[push] /api/push/register failed:", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.warn("[push] registration POST error:", (err as Error).message);
    }
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.warn("[push] registrationError:", err);
  });

  PushNotifications.addListener("pushNotificationReceived", (notification: PushNotificationSchema) => {
    // Foreground delivery — iOS doesn't show a banner by default in this case,
    // so play the overlay immediately.
    if (notification.data?.kind === "feed-ready") {
      flagFeedReady();
    }
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (action: ActionPerformed) => {
    const data = action.notification?.data;
    if (data?.kind === "feed-ready") {
      flagFeedReady();
      // Send the user home so the overlay reveals the freshly-promoted feed.
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }
  });
}

export async function setupPushNotifications(
  getAccessToken: () => Promise<string | null>,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    attachListenersOnce(getAccessToken);

    // Do NOT cold-prompt on sign-in. We only (re)register here when the user
    // has ALREADY granted permission — to refresh the APNs token on every
    // launch. The first-time permission request is deferred to the in-app
    // "enable notifications" nudge (promptEnablePush), so Apple's one-time
    // dialog appears with context, on the user's explicit opt-in.
    const perms = await PushNotifications.checkPermissions();
    if (perms.receive !== "granted") {
      console.log("[push] permission not yet granted — deferring to nudge:", perms.receive);
      return;
    }
    await PushNotifications.register();
  } catch (err) {
    console.warn("[push] setup failed:", (err as Error).message);
  }
}

export type PushPermissionStatus =
  | "granted"
  | "denied"
  | "prompt"
  | "prompt-with-rationale"
  | "unsupported";

/**
 * Read the current notification permission WITHOUT prompting. Returns
 * "unsupported" on web (no native push). Used by the in-app nudge to decide
 * whether to surface the "enable notifications" banner.
 */
export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  if (!Capacitor.isNativePlatform()) return "unsupported";
  try {
    const perms = await PushNotifications.checkPermissions();
    return perms.receive as PushPermissionStatus;
  } catch {
    return "unsupported";
  }
}

/**
 * Request notification permission (shows the OS dialog when the status is still
 * "prompt"), then register for APNs on grant. Returns the resulting status so
 * the caller can update its UI. When the OS status is already "denied" Apple
 * will NOT show a dialog — the call resolves "denied" immediately and the caller
 * should point the user at iOS Settings instead.
 */
export async function promptEnablePush(
  getAccessToken: () => Promise<string | null>,
): Promise<PushPermissionStatus> {
  if (!Capacitor.isNativePlatform()) return "unsupported";
  try {
    attachListenersOnce(getAccessToken);
    const req = await PushNotifications.requestPermissions();
    const status = req.receive as PushPermissionStatus;
    if (status === "granted") {
      await PushNotifications.register();
    }
    return status;
  } catch (err) {
    console.warn("[push] promptEnablePush failed:", (err as Error).message);
    return "unsupported";
  }
}

/**
 * Unregister a device token on sign-out. Call before supabase.auth.signOut so
 * the access token is still valid for the DELETE call.
 */
export async function teardownPushNotifications(
  getAccessToken: () => Promise<string | null>,
  deviceToken: string,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    await fetch(`${PUSH_API_BASE}/api/push/register`, {
      method:  "DELETE",
      headers: {
        "Content-Type":  "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ deviceToken }),
    });
  } catch (err) {
    console.warn("[push] teardown failed:", (err as Error).message);
  }
}
