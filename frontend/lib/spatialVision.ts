/** Downsamples the map's WebGL canvas to a small JPEG before sending it to
 * the spatial-vision AI endpoint — keeps multimodal token/bandwidth usage
 * bounded regardless of the user's actual viewport resolution. Requires the
 * source map to have been created with `canvasContextAttributes:
 * { preserveDrawingBuffer: true }` (RiskMap.tsx already sets this for PDF
 * export), otherwise the canvas reads back blank rather than throwing.
 */
import type { Map as MLMap } from "maplibre-gl";

const MAX_SNAPSHOT_WIDTH = 1024;
const JPEG_QUALITY = 0.7;
// Backend (SpatialVisionRequest.map_image_base64) hard-rejects payloads
// decoding past 1.2MB — this mirrors that ceiling so an oversized snapshot
// fails fast, client-side, with a clear message instead of a round-trip to
// the API followed by a generic 422. Typical viewports land well under
// this — usually tens of KB at these dimensions/quality — but that's an
// observed range, not a guarantee this class enforces.
const MAX_DATA_URL_LENGTH = 1_600_000; // ~1.2MB decoded, base64-inflated

export class SnapshotError extends Error {}

export function getOptimizedCanvasSnapshot(map: MLMap): string {
  const canvas = map.getCanvas();
  if (canvas.width === 0 || canvas.height === 0) {
    throw new SnapshotError("Map canvas has no rendered content yet (zero-sized).");
  }

  const offscreen = document.createElement("canvas");
  const scale = Math.min(1, MAX_SNAPSHOT_WIDTH / canvas.width);
  offscreen.width = Math.max(1, Math.round(canvas.width * scale));
  offscreen.height = Math.max(1, Math.round(canvas.height * scale));

  const ctx = offscreen.getContext("2d");
  if (!ctx) {
    throw new SnapshotError("Could not acquire a 2D canvas context for the snapshot.");
  }

  try {
    ctx.drawImage(canvas, 0, 0, offscreen.width, offscreen.height);
    const dataUrl = offscreen.toDataURL("image/jpeg", JPEG_QUALITY);
    if (dataUrl.length > MAX_DATA_URL_LENGTH) {
      throw new SnapshotError("Optimized snapshot is still too large to send.");
    }
    return dataUrl;
  } catch (err) {
    if (err instanceof SnapshotError) throw err;
    // toDataURL() throws a SecurityError DOMException when the canvas is
    // tainted by cross-origin tile/image content loaded without CORS.
    if (err instanceof DOMException) {
      throw new SnapshotError("Could not capture the map snapshot (canvas is tainted by cross-origin content).");
    }
    throw new SnapshotError("Could not capture the map snapshot.");
  }
}
