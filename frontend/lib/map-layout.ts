import type * as maplibregl from "maplibre-gl";

/**
 * The floating controls over the map mark themselves with data-map-obstruction="top|left|right|bottom".
 * Anything that opens over the map (popups, the evacuation card) asks here for the rectangle that is
 * actually free, instead of guessing offsets. A guess is what let the evacuation card open under the
 * search bar and "Run AI Risk Assessment" button.
 */
export type Side = "top" | "left" | "right" | "bottom";
export interface SafeArea {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

const MARGIN = 12;

/** Free rectangle in the map container's own coordinates. */
export function safeArea(container: HTMLElement): SafeArea {
  const box = container.getBoundingClientRect();
  const area: SafeArea = { top: MARGIN, left: MARGIN, right: box.width - MARGIN, bottom: box.height - MARGIN };
  for (const el of document.querySelectorAll<HTMLElement>("[data-map-obstruction]")) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue; // display:none or collapsed
    const side = el.dataset.mapObstruction as Side;
    if (side === "top") area.top = Math.max(area.top, rect.bottom - box.top + MARGIN);
    else if (side === "bottom") area.bottom = Math.min(area.bottom, rect.top - box.top - MARGIN);
    else if (side === "left") area.left = Math.max(area.left, rect.right - box.left + MARGIN);
    else if (side === "right") area.right = Math.min(area.right, rect.left - box.left - MARGIN);
  }
  // Never return an inverted rectangle on a tiny viewport.
  area.bottom = Math.max(area.bottom, area.top + 120);
  area.right = Math.max(area.right, area.left + 160);
  return area;
}

/** Pan so a popup that just opened is fully inside the free area (maplibre has no autoPan). */
export function revealPopup(map: maplibregl.Map, popup: maplibregl.Popup) {
  requestAnimationFrame(() => {
    const el = popup.getElement();
    if (!el || !popup.isOpen()) return;
    const container = map.getContainer();
    const box = container.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const area = safeArea(container);
    const left = rect.left - box.left;
    const top = rect.top - box.top;
    let dx = 0;
    let dy = 0;
    if (top < area.top) dy = top - area.top;
    else if (top + rect.height > area.bottom) dy = Math.min(top + rect.height - area.bottom, top - area.top);
    if (left < area.left) dx = left - area.left;
    else if (left + rect.width > area.right) dx = Math.min(left + rect.width - area.right, left - area.left);
    if (dx || dy) map.panBy([dx, dy], { duration: 250 });
  });
}
