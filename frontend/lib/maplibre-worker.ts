import { setWorkerUrl } from "maplibre-gl";

/** Must run before the first `new Map()`. The files are copied into
 * public/maplibre/ by scripts/copy-maplibre-worker.mjs (prebuild / predev). */
export const MAPLIBRE_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

setWorkerUrl(MAPLIBRE_WORKER_URL);
