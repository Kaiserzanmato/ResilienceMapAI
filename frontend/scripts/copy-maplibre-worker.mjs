// maplibre-gl v6 is ESM-only and loads its web worker from a real URL. Under
// Next.js/Turbopack/webpack the bundler emits the worker without its sibling
// `maplibre-gl-shared.mjs`, so the worker fails on its first import and the map
// never loads tiles. Serve both files from public/maplibre/ instead (see
// lib/maplibre-worker.ts). Copied from node_modules at build time so it always
// matches the installed version; public/maplibre/ is git-ignored.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const dist = path.join(path.dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json")), "dist");
const dest = path.join(process.cwd(), "public", "maplibre");

mkdirSync(dest, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(path.join(dist, file), path.join(dest, file));
}
console.log(`copied maplibre worker files to ${path.relative(process.cwd(), dest)}/`);
