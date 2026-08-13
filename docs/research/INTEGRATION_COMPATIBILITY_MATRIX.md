# Integration Compatibility Matrix

Research date: 2026-08-13. Authority is classified using the supplied Tier 1-5 model.

| Candidate | Feature | Authority | Cost/license | Freshness/limit | Stack fit & risk | Decision |
|---|---|---|---|---|---|---|
| USGS GeoJSON feeds | Earthquakes | Tier 5 | Public USGS service; attribution retained | Near-real-time summaries; 5-min pull | Existing connector; low | IMPLEMENT |
| USGS FDSN | Earthquake detail/query | Tier 5 | Public service | Query only, bounded | Detail enrichment only; low | IMPLEMENT |
| GDACS | Multi-hazard alerts | Tier 4 | Free API; acknowledge GDACS | Current alerts; published limits not fixed | Existing connector; medium availability | IMPLEMENT |
| NASA EONET v3 | Curated natural events | Tier 4 | NASA public API | Near-real-time; no SLA | Existing connector; supplemental only | SUPPLEMENTAL |
| ReliefWeb | Situation reports | Tier 4 | UN OCHA API; terms/attribution apply | Human-curated, not real-time | Existing connector; text-risk | SUPPLEMENTAL |
| GDELT DOC 2 | News discovery | Tier 2 | Public research service | Dynamic/no published SLA | High false-positive and licensing risk | PROTOTYPE |
| PAGASA/PHIVOLCS/NDRRMC | PH advisories | Tier 5 | Government publications | Bulletin dependent | No stable supported machine interface verified | FUTURE |
| OSM/Overpass | Facilities | Tier 1 | ODbL attribution/share-alike | Community-maintained | Public endpoint unsuitable for live per-user lookup | PROTOTYPE |
| HDX/OCHA datasets | Facilities | Tier 3-4 | Dataset-specific | Release dependent | Import after source-by-source review | FUTURE |
| next-intl | Static UI i18n | N/A | MIT | Build-time dictionaries | Next App Router compatible; medium migration | IMPLEMENT |
| Argos Translate | Dynamic translation | N/A | Open source models vary | Local model dependent | Language-quality and operations benchmark incomplete | PROTOTYPE |
| LibreTranslate | Dynamic translation API | N/A | AGPL-3.0 self-hosted | Configurable | Adds service and copyleft review | REJECT |
| MCP servers | Any | N/A | Varies | N/A | No benefit over scheduled APIs; expands attack surface | REJECT |

Primary references: [USGS feeds](https://earthquake.usgs.gov/earthquakes/feed/), [USGS FDSN](https://earthquake.usgs.gov/fdsnws/event/1/index), [GDACS API quick start](https://www.gdacs.org/Documents/2025/GDACS_API_quickstart_v2.pdf), [EONET v3](https://eonet.gsfc.nasa.gov/docs/v3), [ReliefWeb API](https://apidoc.reliefweb.int/), [LibreTranslate](https://docs.libretranslate.com/api/).
