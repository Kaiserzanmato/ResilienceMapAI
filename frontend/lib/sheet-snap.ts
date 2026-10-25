/** Snap points of the phone bottom sheet. Pure; no imports (tests/sheet-snap.test.mjs). */
export type SheetSnap = "min" | "mid" | "full";
export const SHEET_SNAPS: SheetSnap[] = ["min", "mid", "full"];
export const PEEK_PX = 70;
export const SNAP_LABEL: Record<SheetSnap, string> = { min: "peek", mid: "half height", full: "full height" };

/** Pixel height of a snap point: a ~70px peek, then 45% and 90% of the (dynamic) viewport height. `cap` is
 * the room actually left under the top controls, so a tall sheet never slides beneath the nav or search bar. */
export function snapHeight(snap: SheetSnap, viewportHeight: number, cap = Infinity): number {
  const raw = snap === "min" ? PEEK_PX : snap === "mid" ? viewportHeight * 0.45 : viewportHeight * 0.9;
  return snap === "min" ? raw : Math.max(PEEK_PX, Math.min(raw, cap));
}

/** The snap point closest to a dragged height. */
export function nearestSnap(height: number, viewportHeight: number, cap = Infinity): SheetSnap {
  return SHEET_SNAPS.reduce((best, snap) =>
    Math.abs(snapHeight(snap, viewportHeight, cap) - height) < Math.abs(snapHeight(best, viewportHeight, cap) - height) ? snap : best
  );
}
