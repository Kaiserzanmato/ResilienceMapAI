/** Read feature flags from NEXT_PUBLIC env vars. All default to false for safety. */
function flag(name: string, defaultVal = false): boolean {
  const val = process.env[name];
  if (val === undefined) return defaultVal;
  return val === "true";
}

export const FLAGS = {
  GLOBAL_SOURCE_REGISTRY: flag("NEXT_PUBLIC_ENABLE_GLOBAL_SOURCE_REGISTRY", true),
  SOURCE_AUTO_SYNC: flag("NEXT_PUBLIC_ENABLE_SOURCE_AUTO_SYNC", true),
  SOURCE_HEALTH_MONITORING: flag("NEXT_PUBLIC_ENABLE_SOURCE_HEALTH_MONITORING", true),
  SYNC_AUDIT_LOGS: flag("NEXT_PUBLIC_ENABLE_SYNC_AUDIT_LOGS", true),

  CONFLICT_SECURITY_LAYER: flag("NEXT_PUBLIC_ENABLE_CONFLICT_SECURITY_LAYER", false),
  HUMANITARIAN_LAYER: flag("NEXT_PUBLIC_ENABLE_HUMANITARIAN_LAYER", true),
  AVIATION_LAYER: flag("NEXT_PUBLIC_ENABLE_AVIATION_LAYER", false),
  MARITIME_LAYER: flag("NEXT_PUBLIC_ENABLE_MARITIME_LAYER", false),

  DEEPSEEK_GROUNDED_CONTEXT: flag("NEXT_PUBLIC_ENABLE_DEEPSEEK_GROUNDED_CONTEXT", true),
  HOME_GLOBE_LOADER: flag("NEXT_PUBLIC_ENABLE_HOME_GLOBE_LOADER", true),
} as const;
