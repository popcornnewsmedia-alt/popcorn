import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Point the API client at the real server.
// In production, use relative /api path which resolves to the current domain.
// In dev, if VITE_API_URL is not set, the mock middleware handles it.
const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "." : undefined);
if (apiUrl) {
  setBaseUrl(apiUrl);
}

createRoot(document.getElementById("root")!).render(<App />);
