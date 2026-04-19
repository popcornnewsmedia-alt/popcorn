import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Point the API client at the real server.
// In production: ALWAYS use www.popcornmedia.org (override any env var)
// In dev: if VITE_API_URL is not set, the mock middleware handles it
let apiUrl: string | undefined;

// Detect Capacitor native runtime. The app loads from capacitor://localhost
// on iOS (and http://localhost on Android), so relative API paths resolve to
// a non-existent local origin. Native builds must target the real backend.
const isCapacitor =
  typeof window !== "undefined" &&
  ((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.() ??
    window.location.protocol === "capacitor:");

if (isCapacitor) {
  // Native iOS/Android: always use the absolute production API URL.
  apiUrl = "https://www.popcornmedia.org";
  console.log("[Popcorn] Capacitor native mode - using absolute API base:", apiUrl);
  setBaseUrl(apiUrl);
} else if (import.meta.env.PROD) {
  // In production web, use a relative base URL so API calls stay same-origin
  // on whichever domain the page was loaded from (apex or www). Hardcoding a
  // specific hostname triggers cross-origin CORS preflights + 307 redirects
  // that browsers refuse to follow, surfacing as "network" errors in the UI.
  apiUrl = "";
  console.log("[Popcorn] Production mode - using relative API base");
  setBaseUrl(apiUrl);
} else if (import.meta.env.VITE_API_URL) {
  // In dev mode, use the configured API URL if set
  apiUrl = import.meta.env.VITE_API_URL;
  console.log("[Popcorn] Dev mode - using configured API URL:", apiUrl);
  setBaseUrl(apiUrl);
} else {
  // In dev mode without config, use mock middleware
  console.log("[Popcorn] Dev mode - using mock middleware");
}

createRoot(document.getElementById("root")!).render(<App />);
