/** JS mirror of the `--motion-spring` CSS token (`cubic-bezier(0.32, 0.72, 0, 1)`).
 * Framer Motion's `transition.ease` needs a literal number array, not a CSS var, so this is
 * the single place that duplicates the curve — every menu/sheet/dialog imports it from here
 * rather than re-typing the four numbers. Keep this in sync with globals.css if that token
 * ever changes. */
export const SPRING_EASE = [0.32, 0.72, 0, 1] as const;
