/**
 * Report format generators — pure functions over a canonical ReportSnapshot.
 *
 * No application imports: every format is derived from one immutable snapshot
 * so PDF/TXT/MD/CSV can never disagree with each other or with the UI state
 * at the moment of export. Kept dependency-free so the generators are
 * unit-testable in Node (scripts/test-report-formats.ts).
 */

export interface SnapshotHazard {
  hazard: string;
  score: number | null;
  classification: string | null;
}

export interface SnapshotEvidence {
  id: string;
  title: string;
  summary: string;
  hazardCategory?: string;
  severity?: string;
  status?: string;
  evidenceState?: string;
  confidence?: string;
  freshness?: string;
  verifiedUpdate?: string;
  sources: string[];
}

export interface SnapshotSource {
  id: string;
  label: string;
  url?: string;
}

export interface ReportSnapshot {
  schemaVersion: string;
  reportId: string;
  generatedAt: string;
  appName: string;

  context: {
    locationName: string;
    countryCode: string;
    latitude: number;
    longitude: number;
    persona: string;
    knowledgeRevision: string;
    sourceSnapshotAt: string;
  };

  deterministicRisk: {
    overallScore: number | null;
    classification: string | null;
    hazardScores: SnapshotHazard[];
    mainDrivers: string[];
    confidence: string;
    dataCoverage: string;
  };

  evidence: SnapshotEvidence[];
  sources: SnapshotSource[];
  disclaimers: string[];

  status: {
    freshness: "live" | "near_real_time" | "current" | "stale" | "reference";
    containsStaleData: boolean;
    containsUnavailableData: boolean;
  };
}

/* ------------------------------------------------------------------ CSV */

/**
 * RFC 4180 escaping + spreadsheet formula-injection guard: fields beginning
 * with = + - @ are prefixed with a single quote so Excel/Sheets treat them
 * as text, then normally quoted.
 */
export function csvField(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvField).join(",");
}

/**
 * One normalized CSV with a documented record_type column. Stable columns:
 * record_type,report_id,location,country_code,key,label,value,classification,
 * status,confidence,freshness,source_refs,timestamp
 */
export function snapshotToCsv(s: ReportSnapshot): string {
  const rows: string[] = [];
  const base = (recordType: string) => [recordType, s.reportId, s.context.locationName, s.context.countryCode];
  rows.push(csvRow([
    "record_type", "report_id", "location", "country_code", "key", "label",
    "value", "classification", "status", "confidence", "freshness",
    "source_refs", "timestamp",
  ]));
  rows.push(csvRow([
    ...base("meta"), "schema_version", "Schema Version", s.schemaVersion, "", "", "", "", "", s.generatedAt,
  ]));
  rows.push(csvRow([
    ...base("meta"), "knowledge_revision", "Knowledge Revision", s.context.knowledgeRevision,
    "", "", "", s.status.freshness, "", s.context.sourceSnapshotAt,
  ]));
  rows.push(csvRow([
    ...base("meta"), "persona", "Persona", s.context.persona, "", "", "", "", "", s.generatedAt,
  ]));
  rows.push(csvRow([
    ...base("meta"), "coordinates", "Coordinates",
    `${s.context.latitude}, ${s.context.longitude}`, "", "", "", "", "", s.generatedAt,
  ]));
  rows.push(csvRow([
    ...base("overall_risk"), "overall", "Overall Risk Score",
    s.deterministicRisk.overallScore ?? "No data", s.deterministicRisk.classification ?? "",
    "", s.deterministicRisk.confidence, s.status.freshness, "", s.generatedAt,
  ]));
  for (const h of s.deterministicRisk.hazardScores) {
    rows.push(csvRow([
      ...base("hazard_score"), h.hazard, h.hazard,
      h.score ?? "No data", h.classification ?? "", "", "", "", "", s.generatedAt,
    ]));
  }
  if (s.deterministicRisk.mainDrivers.length) {
    rows.push(csvRow([
      ...base("meta"), "main_drivers", "Main Drivers",
      s.deterministicRisk.mainDrivers.join("; "), "", "", "", "", "", s.generatedAt,
    ]));
  }
  for (const ev of s.evidence) {
    rows.push(csvRow([
      ...base("evidence"), ev.id, ev.title, ev.summary, ev.severity ?? "",
      ev.status ?? "", ev.confidence ?? "", ev.freshness ?? "",
      ev.sources.join("; "), ev.verifiedUpdate ?? "",
    ]));
  }
  for (const src of s.sources) {
    rows.push(csvRow([
      ...base("source"), src.id, src.label, src.url ?? "", "", "", "", "", "", s.generatedAt,
    ]));
  }
  for (const d of s.disclaimers) {
    rows.push(csvRow([...base("disclaimer"), "disclaimer", "Disclaimer", d, "", "", "", "", "", s.generatedAt]));
  }
  return rows.join("\r\n") + "\r\n";
}

/* ------------------------------------------------------------------ TXT */

export function snapshotToText(s: ReportSnapshot): string {
  const L: string[] = [];
  const hr = "=".repeat(64);
  L.push(hr);
  L.push(`${s.appName.toUpperCase()} — RISK INTELLIGENCE REPORT`);
  L.push(hr);
  L.push(`Location:      ${s.context.locationName} (${s.context.countryCode})`);
  L.push(`Coordinates:   ${s.context.latitude}, ${s.context.longitude}`);
  L.push(`Persona:       ${s.context.persona}`);
  L.push(`Generated:     ${s.generatedAt}`);
  L.push(`Report ID:     ${s.reportId}`);
  L.push(`Knowledge rev: ${s.context.knowledgeRevision} (snapshot ${s.context.sourceSnapshotAt})`);
  L.push(`Data status:   ${s.status.freshness}${s.status.containsStaleData ? " — CONTAINS STALE DATA" : ""}`);
  L.push("");
  L.push("DETERMINISTIC RISK ASSESSMENT");
  L.push("-".repeat(64));
  L.push(
    `Overall: ${s.deterministicRisk.overallScore ?? "No data"}/100` +
    (s.deterministicRisk.classification ? ` (${s.deterministicRisk.classification})` : "")
  );
  L.push(`Engine confidence: ${s.deterministicRisk.confidence} | Data coverage: ${s.deterministicRisk.dataCoverage}`);
  L.push("");
  for (const h of s.deterministicRisk.hazardScores) {
    const score = h.score === null ? "No data" : `${h.score}/100 (${h.classification ?? "-"})`;
    L.push(`  ${h.hazard.padEnd(22)} ${score}`);
  }
  if (s.deterministicRisk.mainDrivers.length) {
    L.push("");
    L.push(`Main drivers: ${s.deterministicRisk.mainDrivers.join(", ")}`);
  }
  if (s.evidence.length) {
    L.push("");
    L.push("ACTIVE WATCHLIST & EVIDENCE");
    L.push("-".repeat(64));
    for (const ev of s.evidence) {
      L.push(`* ${ev.title}`);
      L.push(`  Severity: ${ev.severity ?? "-"} | Status: ${ev.status ?? "-"} | Evidence: ${ev.evidenceState ?? "-"} | Freshness: ${ev.freshness ?? "-"}`);
      L.push(`  ${ev.summary}`);
      if (ev.verifiedUpdate) L.push(`  Verified: ${ev.verifiedUpdate}`);
      if (ev.sources.length) L.push(`  Sources: ${ev.sources.join(", ")}`);
      L.push("");
    }
  }
  L.push("SOURCES");
  L.push("-".repeat(64));
  for (const src of s.sources) {
    L.push(`  [${src.id}] ${src.label}${src.url ? ` — ${src.url}` : ""}`);
  }
  L.push("");
  L.push("DISCLAIMERS");
  L.push("-".repeat(64));
  for (const d of s.disclaimers) L.push(`  ${d}`);
  L.push("");
  L.push(hr);
  return L.join("\n");
}

/* ------------------------------------------------------------------ MD */

function mdEscape(text: string): string {
  // Strip raw HTML angle brackets so exported markdown never carries
  // unsafe/unsanitized markup.
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function snapshotToMarkdown(s: ReportSnapshot): string {
  const L: string[] = [];
  L.push(`# ${s.appName} — Risk Intelligence Report`);
  L.push("");
  L.push(`**Location:** ${mdEscape(s.context.locationName)} (${s.context.countryCode})  `);
  L.push(`**Coordinates:** ${s.context.latitude}, ${s.context.longitude}  `);
  L.push(`**Persona:** ${s.context.persona}  `);
  L.push(`**Generated:** ${s.generatedAt}  `);
  L.push(`**Data status:** ${s.status.freshness}${s.status.containsStaleData ? " — contains stale data" : ""}`);
  L.push("");
  L.push("## Deterministic Risk Assessment");
  L.push("");
  L.push(
    `**Overall:** ${s.deterministicRisk.overallScore ?? "No data"}/100` +
    (s.deterministicRisk.classification ? ` — **${s.deterministicRisk.classification}**` : "")
  );
  L.push(`Engine confidence: ${s.deterministicRisk.confidence} · Data coverage: ${s.deterministicRisk.dataCoverage}`);
  L.push("");
  L.push("| Hazard | Score | Classification |");
  L.push("|---|---|---|");
  for (const h of s.deterministicRisk.hazardScores) {
    L.push(`| ${mdEscape(h.hazard)} | ${h.score ?? "No data"} | ${h.classification ?? "—"} |`);
  }
  if (s.deterministicRisk.mainDrivers.length) {
    L.push("");
    L.push(`**Main drivers:** ${s.deterministicRisk.mainDrivers.map(mdEscape).join(", ")}`);
  }
  if (s.evidence.length) {
    L.push("");
    L.push("## Active Watchlist & Evidence");
    for (const ev of s.evidence) {
      L.push("");
      L.push(`### ${mdEscape(ev.title)}`);
      L.push(`*${ev.severity ?? "-"} · ${ev.status ?? "-"} · ${ev.evidenceState ?? "-"} · freshness: ${ev.freshness ?? "-"}*`);
      L.push("");
      L.push(mdEscape(ev.summary));
      if (ev.verifiedUpdate) L.push(`\n**Verified:** ${mdEscape(ev.verifiedUpdate)}`);
      if (ev.sources.length) L.push(`**Sources:** ${ev.sources.map(mdEscape).join(", ")}`);
    }
  }
  L.push("");
  L.push("## Sources");
  L.push("");
  for (const src of s.sources) {
    L.push(src.url ? `- **${src.id}** — [${mdEscape(src.label)}](${src.url})` : `- **${src.id}** — ${mdEscape(src.label)}`);
  }
  L.push("");
  L.push("## Reproducibility");
  L.push("");
  L.push(`- Report ID: \`${s.reportId}\``);
  L.push(`- Schema version: \`${s.schemaVersion}\``);
  L.push(`- Knowledge revision: \`${s.context.knowledgeRevision}\``);
  L.push(`- Source snapshot: \`${s.context.sourceSnapshotAt}\``);
  L.push("");
  L.push("## Disclaimers");
  L.push("");
  for (const d of s.disclaimers) L.push(`> ${mdEscape(d)}`);
  L.push("");
  return L.join("\n");
}
