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

    const perms = await PushNotifications.checkPermissions();
    let status = perms.receive;
    if (status === "prompt" || status === "prompt-with-rationale") {
      const req = await PushNotifications.requestPermissions();
      status = req.receive;
    }
    if (status !== "granted") {
      console.log("[push] permission not granted:", status);
      return;
    }
    await PushNotifications.register();
  } catch (err) {
    console.warn("[push] setup failed:", (err as Error).message);
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
