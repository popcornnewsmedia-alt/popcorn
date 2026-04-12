// build-rerun-prod.mjs
//
// One-off esbuild bundle for the production image rerun CLI.
// Writes dist/cli/rerun-images-prod.mjs. Like build-dry-run.mjs but for
// the real-DB rerun variant that keeps focal detection enabled.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { createRequire } from "node:module";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

await esbuild({
  entryPoints: [path.resolve(artifactDir, "src/cli/rerun-images-prod.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outfile: path.resolve(artifactDir, "dist/cli/rerun-images-prod.mjs"),
  logLevel: "info",
  external: [
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

console.log("✅ dist/cli/rerun-images-prod.mjs built");
