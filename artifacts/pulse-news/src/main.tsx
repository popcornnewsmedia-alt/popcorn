import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Point the API client at the real server.
// In production: don't set a base URL - let requests be relative (will use current domain)
// In dev: if VITE_API_URL is not set, the mock middleware handles it
const apiUrl = import.meta.env.VITE_API_URL;

if (apiUrl) {
  console.log("[Popcorn] Setting API base URL to:", apiUrl);
  setBaseUrl(apiUrl);
} else if (import.meta.env.PROD) {
  // In production without explicit VITE_API_URL, use relative paths (no base URL)
  console.log("[Popcorn] Using relative API paths (no base URL)");
} else {
  // In dev, the mock middleware handles requests
  console.log("[Popcorn] Dev mode - using mock middleware");
}

createRoot(document.getElementById("root")!).render(<App />);
