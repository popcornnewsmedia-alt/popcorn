import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { startEnrichment } from "./lib/article-store.js";
import { loadFromSupabase } from "./lib/curated-store.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const ALLOWED_ORIGINS = [
  "https://popcornmedia.org",
  "https://www.popcornmedia.org",
  "http://localhost:5173",
  "http://192.168.1.38:5173",
];
app.use(
  cors({
    origin: (origin, cb) =>
      !origin || ALLOWED_ORIGINS.includes(origin)
        ? cb(null, true)
        : cb(new Error("CORS: origin not allowed")),
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Always restore the persisted feed from Supabase (or local files) on startup.
// This is separate from enrichment — we always want the saved articles to appear.
loadFromSupabase().catch((e) => console.error("[api] loadFromSupabase failed:", e));

// Only run the enrichment/curation pipeline when explicitly enabled.
if (process.env.ENABLE_ENRICHMENT === "true") {
  startEnrichment().catch((e) => console.error("[api] startEnrichment failed:", e));
}

export default app;
