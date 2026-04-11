import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Point the API client at the real server.
// In production: ALWAYS use www.popcornmedia.org (override any env var)
// In dev: if VITE_API_URL is not set, the mock middleware handles it
let apiUrl: string | undefined;

if (import.meta.env.PROD) {
  // In production, always use the www domain explicitly
  apiUrl = "https://www.popcornmedia.org";
  console.log("[Popcorn] Production mode - using:", apiUrl);
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
