import {
  SOURCE_REGISTRY,
  getPrioritizedSources,
  type RiskDomain,
  type RiskSource,
} from "@/data-sources/registry/sources.registry";
import { isDataStale } from "@/data-sources/validators/validate-source-response";
import { getCountryByAlpha2 } from "@/lib/locations/country-search";
import { selectSourcesForCountry } from "@/data-sources/registry/country-source-routing";

export interface GroundedContext {
  location?: string;
  country?: string;
  countryAlpha2?: string;
  countryAlpha3?: string;
  countryOfficialName?: string;
  domain?: RiskDomain;
  approvedSources: RiskSourceContext[];
  staleSources: string[];
  unavailableSources: string[];
  contextBuiltAt: string;
}

export interface RiskSourceContext {
  id: string;
  name: string;
  organization: string;
  url: string;
  docsUrl?: string;
  trustLevel: number;
  confidenceCategory: string;
  coverage: string;
  autoSyncEnabled: boolean;
  lastSuccessfulSyncAt?: string;
  isStale: boolean;
}

/**
 * Build the grounded context object that is passed to the AI layer.
 * Only enabled, approved sources are included.
 * Stale sources are flagged — the AI must disclose when data is stale.
 * Country codes (alpha2, alpha3) are resolved if provided.
 */
export function buildGroundedContext(opts: {
  location?: string;
  country?: string;
  countryAlpha2?: string;
  domain?: RiskDomain;
}): GroundedContext {
  // Resolve country metadata
  let countryAlpha2 = opts.countryAlpha2;
  let countryData = countryAlpha2 ? getCountryByAlpha2(countryAlpha2) : undefined;

  // Select sources: use country-aware routing if alpha2 provided, else generic prioritization
  let prioritized = opts.domain && countryAlpha2
    ? selectSourcesForCountry(countryAlpha2, opts.domain)
    : getPrioritizedSources(opts.country, opts.domain);

  const approvedSources: RiskSourceContext[] = [];
  const staleSources: string[] = [];
  const unavailableSources: string[] = [];

  for (const source of prioritized) {
    const stale =
      source.autoSyncEnabled &&
      source.syncFrequencyMinutes != null &&
      isDataStale(source.lastSuccessfulSyncAt, source.syncFrequencyMinutes);

    if (source.lastSyncStatus === "failed") {
      unavailableSources.push(source.name);
    }

    if (stale) staleSources.push(source.name);

    approvedSources.push({
      id: source.id,
      name: source.name,
      organization: source.organization,
      url: source.url,
      docsUrl: source.docsUrl,
      trustLevel: source.trustLevel,
      confidenceCategory: source.confidenceCategory,
      coverage: source.coverage,
      autoSyncEnabled: source.autoSyncEnabled,
      lastSuccessfulSyncAt: source.lastSuccessfulSyncAt,
      isStale: stale,
    });
  }

  return {
    location: opts.location,
    country: opts.country || countryData?.name,
    countryAlpha2: countryAlpha2 || countryData?.alpha2,
    countryAlpha3: countryData?.alpha3,
    countryOfficialName: countryData?.officialName,
    domain: opts.domain,
    approvedSources,
    staleSources,
    unavailableSources,
    contextBuiltAt: new Date().toISOString(),
  };
}

/** Format the grounded context as a text block for injection into the AI system prompt. */
export function formatGroundedContextBlock(ctx: GroundedContext): string {
  const lines: string[] = [
    "=== APPROVED SOURCE REGISTRY CONTEXT ===",
    `Context built at: ${ctx.contextBuiltAt}`,
  ];

  if (ctx.location) lines.push(`Location: ${ctx.location}`);
  if (ctx.country) lines.push(`Country: ${ctx.country}`);
  if (ctx.domain) lines.push(`Risk domain: ${ctx.domain}`);

  lines.push("", "Approved sources for this context:");
  for (const s of ctx.approvedSources) {
    lines.push(
      `  - ${s.name} (${s.organization}) | Trust: ${s.trustLevel} | ${s.coverage} | ${s.confidenceCategory}`,
      `    URL: ${s.url}`,
      s.lastSuccessfulSyncAt
        ? `    Last synced: ${s.lastSuccessfulSyncAt}`
        : "    Last synced: never (manual grounding only)",
      s.isStale ? "    ⚠ DATA IS STALE — disclose this to the user" : ""
    );
  }

  if (ctx.staleSources.length > 0) {
    lines.push("", `⚠ Stale sources (disclose): ${ctx.staleSources.join(", ")}`);
  }

  if (ctx.unavailableSources.length > 0) {
    lines.push(
      "",
      `✗ Unavailable sources (last sync failed): ${ctx.unavailableSources.join(", ")}`,
      "If these are the only sources for this query, inform the user that no current verified data was retrieved."
    );
  }

  lines.push("=== END APPROVED SOURCE REGISTRY CONTEXT ===");
  return lines.filter(Boolean).join("\n");
}

/** The system guardrail injected at the top of every AI conversation. */
export const DEEPSEEK_SYSTEM_GUARDRAIL = `You are ResilienceMap AI.

You answer only questions related to disaster risk, climate risk, natural hazards, humanitarian crises, conflict and security risk, aviation risk, maritime risk, infrastructure disruption, supply chain disruption, force majeure, and resilience planning.

Use only the approved source registry and retrieved context.

Do not invent facts, events, advisories, alerts, fatalities, coordinates, locations, or official confirmations.

If live data is unavailable, say that no current verified source was retrieved and recommend checking the official agency.

For every answer based on retrieved information, include:
- source name
- source URL
- timestamp if available
- confidence category
- coverage type: global, regional, or country-specific

Never claim a disaster, conflict, security event, aviation advisory, or maritime incident is officially confirmed unless the cited source confirms it.

Risk scores are computed by the deterministic backend risk engine, never by the AI model.`;

/** Get the full source registry list formatted for the AI context panel. */
export function getSourceRegistryForDisplay(): {
  global: RiskSource[];
  regional: RiskSource[];
  countrySpecific: RiskSource[];
} {
  return {
    global: SOURCE_REGISTRY.filter((s) => s.coverage === "global" && s.enabled),
    regional: SOURCE_REGISTRY.filter((s) => s.coverage === "regional" && s.enabled),
    countrySpecific: SOURCE_REGISTRY.filter((s) => s.coverage === "country-specific" && s.enabled),
  };
}
