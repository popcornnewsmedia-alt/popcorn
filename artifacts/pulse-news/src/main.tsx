import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Point the API client at the real server.
// In production: use current domain via window.location.origin
// In dev: if VITE_API_URL is not set, the mock middleware handles it
const apiUrl =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? window.location.origin : undefined);

if (apiUrl) {
  console.log("[Popcorn] Setting API base URL to:", apiUrl);
  setBaseUrl(apiUrl);
} else {
  console.log("[Popcorn] No API base URL set - using mock middleware");
}

createRoot(document.getElementById("root")!).render(<App />);
