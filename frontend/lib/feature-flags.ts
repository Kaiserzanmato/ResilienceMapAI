/**
 * Feature flags from NEXT_PUBLIC env vars.
 *
 * Every flag must read its variable by LITERAL name (`process.env.NEXT_PUBLIC_X`).
 * Next.js only inlines NEXT_PUBLIC_ variables into the browser bundle where it can
 * see the full name at build time; a computed lookup such as `process.env[name]`
 * is left as-is, finds nothing in the browser, and silently falls back to the
 * default, so the variable set on Vercel is ignored. tests/feature-flags.test.mjs
 * and the no-restricted-syntax rule in eslint.config.mjs both guard against that.
 */
function flag(value: string | undefined, defaultVal = false): boolean {
  if (value === undefined) return defaultVal;
  return value === "true";
}

export const FLAGS = {
  GLOBAL_SOURCE_REGISTRY: flag(process.env.NEXT_PUBLIC_ENABLE_GLOBAL_SOURCE_REGISTRY, true),
  SOURCE_AUTO_SYNC: flag(process.env.NEXT_PUBLIC_ENABLE_SOURCE_AUTO_SYNC, true),
  SOURCE_HEALTH_MONITORING: flag(process.env.NEXT_PUBLIC_ENABLE_SOURCE_HEALTH_MONITORING, true),
  SYNC_AUDIT_LOGS: flag(process.env.NEXT_PUBLIC_ENABLE_SYNC_AUDIT_LOGS, true),

  CONFLICT_SECURITY_LAYER: flag(process.env.NEXT_PUBLIC_ENABLE_CONFLICT_SECURITY_LAYER, false),
  HUMANITARIAN_LAYER: flag(process.env.NEXT_PUBLIC_ENABLE_HUMANITARIAN_LAYER, true),
  AVIATION_LAYER: flag(process.env.NEXT_PUBLIC_ENABLE_AVIATION_LAYER, false),
  MARITIME_LAYER: flag(process.env.NEXT_PUBLIC_ENABLE_MARITIME_LAYER, false),

  DEEPSEEK_GROUNDED_CONTEXT: flag(process.env.NEXT_PUBLIC_ENABLE_DEEPSEEK_GROUNDED_CONTEXT, true),
  HOME_GLOBE_LOADER: flag(process.env.NEXT_PUBLIC_ENABLE_HOME_GLOBE_LOADER, true),
  REALTIME_EVENTS: flag(process.env.NEXT_PUBLIC_ENABLE_REALTIME_EVENTS, false),
  // Satellite flood extents + the "Flag flooding here" button. The backend has its
  // own ENABLE_FLOOD_CAPTURE switch; turn both on together.
  FLOOD_CAPTURE: flag(process.env.NEXT_PUBLIC_ENABLE_FLOOD_CAPTURE, false),
} as const;
