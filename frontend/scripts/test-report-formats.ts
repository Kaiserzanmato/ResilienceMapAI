/**
 * Unit tests for the pure report format generators.
 * Run: npx tsx scripts/test-report-formats.ts
 * (No test framework in this project — this script exits non-zero on failure.)
 */
import {
  csvField,
  snapshotToCsv,
  snapshotToText,
  snapshotToMarkdown,
  type ReportSnapshot,
} from "../lib/report-formats";

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ FAIL: ${name}`);
  }
}

const fixture: ReportSnapshot = {
  schemaVersion: "1.0",
  reportId: "test-report-0001",
  generatedAt: "2026-07-06T12:00:00.000Z",
  appName: "ResilienceMap AI",
  context: {
    locationName: "Tacloban, City of \"Waves\"",
    countryCode: "PH",
    latitude: 11.243,
    longitude: 125.008,
    persona: "citizen",
    knowledgeRevision: "2026-07-strategic-assessment-v1",
    sourceSnapshotAt: "2026-07-06",
  },
  deterministicRisk: {
    overallScore: 70,
    classification: "High",
    hazardScores: [
      { hazard: "Storm Surge", score: 92, classification: "High" },
      { hazard: "Flood", score: 66, classification: "High" },
      { hazard: "Drought", score: null, classification: null },
    ],
    mainDrivers: ["Storm Surge", "Tropical Cyclone"],
    confidence: "High",
    dataCoverage: "High",
  },
  evidence: [
    {
      id: "ke-ph-mayon",
      title: "Mayon Volcano — Alert Level 3 <script>alert(1)</script>",
      summary: "Effusive eruption, day 183. Line1\nLine2, with comma.",
      severity: "High",
      status: "active",
      evidenceState: "official_warning",
      confidence: "High",
      freshness: "current",
      verifiedUpdate: "DOST-PHIVOLCS Bulletin, 2026-07-05",
      sources: ["DOST-PHIVOLCS", "Smithsonian/USGS GVP"],
    },
  ],
  sources: [
    { id: "S1", label: "PAGASA", url: "https://www.pagasa.dost.gov.ph" },
    { id: "S2", label: "=cmd|calc injection attempt" },
  ],
  disclaimers: ["Not an emergency warning or dispatch service."],
  status: { freshness: "current", containsStaleData: false, containsUnavailableData: false },
};

console.log("csvField escaping:");
check("plain value unchanged", csvField("hello") === "hello");
check("comma is quoted", csvField("a,b") === '"a,b"');
check("quote is doubled", csvField('say "hi"') === '"say ""hi"""');
check("newline is quoted", csvField("a\nb") === '"a\nb"');
check("formula = is neutralized", csvField("=SUM(A1)").startsWith("'="));
check("formula @ is neutralized", csvField("@cmd").startsWith("'@"));
check("formula + is neutralized", csvField("+1+1").startsWith("'+"));
check("null becomes empty", csvField(null) === "");

console.log("snapshotToCsv:");
const csv = snapshotToCsv(fixture);
check("has header row", csv.startsWith("record_type,report_id,location"));
check("uses CRLF line endings", csv.includes("\r\n"));
check("contains report id on rows", csv.split("test-report-0001").length > 5);
check("hazard score row present", csv.includes("hazard_score") && csv.includes("Storm Surge"));
check("null score becomes 'No data'", csv.includes("No data"));
check("evidence row keeps source refs", csv.includes("DOST-PHIVOLCS; Smithsonian/USGS GVP"));
check("source row has URL", csv.includes("https://www.pagasa.dost.gov.ph"));
check("formula-injection label neutralized", csv.includes("'=cmd|calc"));
check("knowledge revision recorded", csv.includes("2026-07-strategic-assessment-v1"));
check("no literal 'undefined' leaks", !csv.includes("undefined"));

console.log("snapshotToText:");
const txt = snapshotToText(fixture);
check("contains location", txt.includes("Tacloban"));
check("contains overall score", txt.includes("70/100"));
check("contains knowledge revision", txt.includes("2026-07-strategic-assessment-v1"));
check("contains evidence state label", txt.includes("official_warning"));
check("contains source URL", txt.includes("https://www.pagasa.dost.gov.ph"));
check("contains disclaimer", txt.includes("Not an emergency warning"));
check("no data hazard labeled", txt.includes("No data"));

console.log("snapshotToMarkdown:");
const md = snapshotToMarkdown(fixture);
check("has title heading", md.startsWith("# ResilienceMap AI"));
check("has hazard table", md.includes("| Hazard | Score | Classification |"));
check("has reproducibility section", md.includes("## Reproducibility") && md.includes("`test-report-0001`"));
check("HTML in evidence title is escaped", md.includes("&lt;script&gt;") && !md.includes("<script>"));
check("source rendered as link", md.includes("[PAGASA](https://www.pagasa.dost.gov.ph)"));
check("disclaimer as blockquote", md.includes("> Not an emergency warning"));

if (failures > 0) {
  console.error(`\n${failures} test(s) FAILED`);
  process.exit(1);
}
console.log("\nAll report-format tests passed.");
