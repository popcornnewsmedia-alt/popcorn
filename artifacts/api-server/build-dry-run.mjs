// build-dry-run.mjs
//
// One-off esbuild bundle for the dry-run image-selection CLI.
// Writes dist/cli/dry-run-images.mjs. No pino plugin needed since the CLI
// doesn't initialise the Express logger.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { createRequire } from "node:module";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

await esbuild({
  entryPoints: [path.resolve(artifactDir, "src/cli/dry-run-images.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outfile: path.resolve(artifactDir, "dist/cli/dry-run-images.mjs"),
  logLevel: "info",
  external: [
    // Externalise things the lib might pull in that we don't need here
    "pino",
    "pino-pretty",
    "pino-http",
    "express",
    "cors",
    "cookie-parser",
  ],
  sourcemap: "linked",
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
`,
  },
});

console.log("✅ dist/cli/dry-run-images.mjs built");
