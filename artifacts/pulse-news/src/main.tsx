import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Point the API client at the real server.
// In production: use www.popcornmedia.org explicitly
// In dev: if VITE_API_URL is not set, the mock middleware handles it
let apiUrl = import.meta.env.VITE_API_URL;

if (!apiUrl && import.meta.env.PROD) {
  // Hardcode production API URL
  apiUrl = "https://www.popcornmedia.org";
}

if (apiUrl) {
  console.log("[Popcorn] Setting API base URL to:", apiUrl);
  setBaseUrl(apiUrl);
} else {
  console.log("[Popcorn] Dev mode - using mock middleware");
}

createRoot(document.getElementById("root")!).render(<App />);
