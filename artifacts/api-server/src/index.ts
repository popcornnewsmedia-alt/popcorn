// Preflight must be first — validates env before any module tries to use it.
import "./lib/preflight.js";
import app from "./app";
import { logger } from "./lib/logger";

const port = Number(process.env["PORT"]);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env["PORT"]}"`);
}

app.listen(port, '0.0.0.0', (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
