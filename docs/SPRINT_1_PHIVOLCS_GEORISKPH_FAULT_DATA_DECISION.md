# Sprint 1 PHIVOLCS / GeoRiskPH fault-data decision

**Decision status:** Approved with implementation blockers
**Approval record:** Issue #9, Approval 2
**Scope:** Research and documentation only. This record authorizes no ingestion, schema, scoring, connector, source enablement, secret, deployment, or infrastructure change.

## 1. Decision requested

Select, or explicitly defer, a PHIVOLCS/GeoRiskPH active-fault distribution for the Sprint 1 `active_fault` exposure component. The approval must establish the exact artifact or service, permitted public use, attribution, steward, update contract, validation evidence, and a scientifically approved distance policy.

Until written source authorization and all required evidence are accepted, `active_fault` remains `out_of_coverage` or `unavailable`; no fault connector, map layer, component score, or public proximity result is authorized.

## 2. Official primary-source research record

| Official source | Finding | Decision consequence |
| --- | --- | --- |
| [PHIVOLCS ActiveFault MapServer](https://gisweb.phivolcs.dost.gov.ph/arcgis/rest/services/PHIVOLCS/ActiveFault/MapServer) | Official DOST-PHIVOLCS map service. It describes a Philippines active-fault map derived from geomorphic analysis, imagery, maps, literature, and field surveys; declares EPSG:4326, DOST-PHIVOLCS copyright, map-image export formats, and advertised JSON/AMF/GeoJSON query formats. At review it exposes no feature layers and no FeatureServer download endpoint. | Candidate for provenance/reference only. It is **not** an approved vector-ingestion endpoint without written PHIVOLCS confirmation of a supported query/service contract, terms, and stable layer identity. |
| [PHIVOLCS GeoHazards downloads](https://gisweb.phivolcs.dost.gov.ph/gisweb/storage/hazard-maps/national/earthquake/ground-rupture-%28active-fault%29/) | Official download directory exposes rendered map images and KMZ files, with dated items. It does not publish a machine-readable license, schema, stable dataset version contract, or permission for automated extraction/public republication. | KMZ/PNG/JPG are reference artifacts only; do not treat them as an approved production vector source or parse them without a written data agreement. |
| [PHIVOLCS FaultFinder](https://www.phivolcs.dost.gov.ph/information-tools/the-phivolcs-faultfinder/) | PHIVOLCS describes proximity output as nearest-fault distance, fault/segment name, mapping year, and map scale. It advises users to consult PHIVOLCS directly for official hazard assessment. | Supports a conservative exposure-distance framing, not a probability, activity, or advisory claim. FaultFinder itself is not a bulk/vector distribution. |
| [HazardHunterPH homepage](https://hazardhunter.georisk.gov.ph/) and [FAQ](https://hazardhunter.georisk.gov.ph/index.php/faqs) | GeoRiskPH is a PHIVOLCS-led, DOST operationalized service using government-agency hazard information. The FAQ says users should request vector files directly from government agencies; HazardHunterPH reports are reference material and official documents must be requested from the concerned agency. | HazardHunterPH is an authoritative assessment/reference channel, not an approved data-export API or vector license. |
| [HazardHunterPH Terms of Use](https://hazardhunter.georisk.gov.ph/index.php/terms-of-use) | The published terms reserve intellectual-property rights and prohibit republishing, copying, or redistribution unless material is specifically made for redistribution. | Public display, caching, export, and derivative use require written license/permission from the responsible data steward. |
| [HazardHunterPH contact](https://hazardhunter.georisk.gov.ph/index.php/contact-us) | Official contact path: `georisk@phivolcs.dost.gov.ph`, PHIVOLCS Building, C.P. Garcia Avenue, U.P. Campus, Diliman, Quezon City; published office phone and business hours. | Use as the initial data-steward/contact and escalation route; retain request and written response in approval evidence. |

### Research conclusion

**Approved policy: no distribution endpoint is approved yet.** The candidate is a PHIVOLCS-issued, machine-readable vector artifact or documented service endpoint obtained through written confirmation from PHIVOLCS/GeoRiskPH. The approval record must name the immutable endpoint or delivery channel, format, layer/resource identifier, permitted automated access, license, attribution, and change-notice process.

This conclusion deliberately does not scrape or reverse-engineer HazardHunterPH, FaultFinder, map imagery, KMZ files, or undocumented ArcGIS behavior. It keeps the project consistent with the merged deterministic-hazard blueprint’s prohibition on portal scraping and its source-by-source acceptance requirement.

## 3. Approved distribution-selection contract

### 3.1 Required recorded values before approval

| Field | Proposed requirement | Status |
| --- | --- | --- |
| Publisher and steward | DOST-PHIVOLCS, with a named PHIVOLCS/GeoRiskPH data steward and backup/contact escalation. | Proposed / Pending Approval |
| Exact distribution | Stable HTTPS endpoint, formal delivery channel, or signed release package; identify ArcGIS service/layer only if PHIVOLCS confirms it is supported for this purpose. | Proposed / Pending Approval |
| Available format | Preferred: documented GeoJSON, GeoPackage, Shapefile, or official ArcGIS Feature Service. Accept KMZ only if PHIVOLCS expressly approves automated vector use and publishes schema/terms. | Proposed / Pending Approval |
| License and use | Written permission for retained processing, derivative proximity analysis, Map/Dashboard/AI display, and authorized export; attribution text and any non-commercial/no-redistribution conditions. | Proposed / Pending Approval |
| Coverage | Philippines geometry/bounds, mapped areas, material gaps, scale/resolution, temporal scope, and feature-status semantics. | Proposed / Pending Approval |
| Cadence | Published update cadence/SLA, change notice, review/renewal date, and maximum last-known-good age. | Proposed / Pending Approval |
| Versioning | Publisher release/version/date where supplied; otherwise retrieval time plus canonical artifact hash, hash algorithm, size, and manifest. | Proposed / Pending Approval |

### 3.2 Attribution and public-display recommendation

The proposed default attribution is “Active-fault data: DOST-PHIVOLCS, [release/version]; displayed under written permission.” This is only a placeholder until PHIVOLCS/GeoRiskPH supplies required wording. All views must also say that the result is screening information, not an official advisory or a site-specific official hazard assessment.

The source must never be represented as endorsing ResilienceMap AI, and no output may identify a PHIVOLCS result as an official document unless PHIVOLCS has expressly issued that document.

## 4. Approved stewardship and escalation path

1. Submit a written request to `georisk@phivolcs.dost.gov.ph` requesting the official active-fault vector distribution, data dictionary, license/terms, permitted use, attribution, update cadence, contact steward, and change-notice process.
2. Retain the request, written PHIVOLCS/GeoRiskPH response, license/DUA or memorandum, and named primary/backup steward in the approval record.
3. Use the published PHIVOLCS/GeoRiskPH contact route for data-quality, availability, licensing, or change-escalation; do not rely on an undocumented individual, web scrape, or inferred service behavior.
4. If the steward cannot provide vector/public-use permission, retain `active_fault` as no-data and use PHIVOLCS links only as public reference material where permitted.

**Acceptance criteria:** the approval artifact identifies a named organization role, written authorization, primary and escalation contact route, review date, renewal date, and response-time expectation.

## 5. Approved data characteristics, limitations, and validation

### 5.1 Expected characteristics to verify, not assume

- The public MapServer identifies EPSG:4326 and decimal-degree map units; the accepted artifact must independently declare CRS and be normalized to EPSG:4326 with transformation metadata retained.
- The expected geometry is `LineString` or `MultiLineString`, but this must be confirmed from the accepted source schema. Do not infer vector geometry from map rendering.
- The public service’s displayed initial extent is broader than the Philippines while its cited map is Philippine active faults; use the accepted artifact’s actual coverage geometry, not an interface extent, as the coverage contract.
- FaultFinder documents nearest-fault distance, name/segment, mapping year, and map scale; these fields are useful provenance when supplied, but may not be invented or backfilled from third-party data.
- A mapped active fault is an exposure feature. It is not an active earthquake event, fault-motion observation, rupture forecast, or official warning.

### 5.2 Validation requirements

1. Verify publisher identity, written use permission, artifact checksum, file format, schema/data dictionary, CRS, geometry type, feature count, attribute completeness, and release/version/date before acceptance.
2. Reject invalid topology, unknown CRS, unsupported geometry, unlicensed data, absent coverage metadata, unexpected schema changes, and incomplete downloads; no partial artifact may replace accepted data.
3. Preserve source artifact and normalized artifact hashes, hash algorithm, retrieval time, release/version, transformation version, validation result, and canonical manifest.
4. Retain prior accepted data as last-known-good only within an approved maximum age; mark it `stale`, never current. Expired or unlicensed data is not used or publicly displayed.

**Acceptance criteria:** fixture and operational evidence prove deterministic acceptance/rejection, reproducible hashes/manifests, valid CRS/geometry handling, explicit coverage states, and last-known-good rollback without deletion.

## 6. Approved PostGIS handling and spatial-regression evidence

This is a design requirement, not authorization to implement.

- Preserve original approved geometry and normalized EPSG:4326 geometry separately; store only source attributes authorized by the data agreement.
- Model accepted fault traces as `LineString`/`MultiLineString` only when the approved schema confirms them. Validate geometry and use a GiST index on the normalized geometry/geography representation.
- For a location, use geography `ST_DWithin` as a documented maximum-band prefilter, then spheroidal `ST_Distance` for the nearest accepted trace. Record query CRS, method, threshold, nearest feature/version, and coverage state in the snapshot manifest.
- Use `EXPLAIN`/`EXPLAIN ANALYZE` evidence to confirm index usage on representative Philippine fixtures. Do not use arbitrary map projection distance or a client-side nearest-line calculation as authoritative.
- Required regression fixtures: known PHIVOLCS reference locations where a published distance/name/segment/mapping metadata is available; near-line, far-line, boundary, island/coastal, antimeridian-safe normalization, invalid geometry, missing coverage, stale version, and equal-distance tie cases.

**Acceptance criteria:** approved fixtures reproduce distance units and nearest-trace selection for the approved artifact/version; query-plan evidence shows the intended index path; invalid or unapproved data cannot produce a proximity output.

## 7. Approved distance-only policy — scientific score approval still required

### Policy boundary

The only permissible initial semantic is **nearest known active-fault exposure distance**, tied to the accepted source/version, map scale/resolution, and coverage. It may be displayed as distance and provenance with the required screening disclaimer.

Any distance-to-risk band, score curve, “zone of avoidance,” or uncertainty language beyond source-provided distance facts remains **Pending Scientific Approval**. It requires named approval from a qualified PHIVOLCS-designated or independently documented hazard-science authority, with evidence for the threshold, geographic applicability, map-scale limitations, and public wording.

### Explicit prohibitions

- Do not infer rupture probability, recurrence probability, fault movement, earthquake probability, or time-to-event from distance, geometry, age, or absence of a mapped trace.
- Do not label a fault as currently active, moving, safe, unsafe, official, or advisory based solely on this component.
- Do not turn an unmapped area, stale dataset, unavailable source, or distance above a band into low risk.
- Do not use a third-party or AI-generated curve as scientific evidence.

### Approved default before any score-curve approval

Display no `active_fault` score. If a licensed, accepted vector source is later approved, display the nearest known active-fault distance and data limitations only; keep the derived score component `not_applicable`, `out_of_coverage`, or `unknown` until the scientific curve is approved.

**Acceptance criteria:** automated and manual review prove outputs are distance/provenance only until the scientific decision exists and contain none of the prohibited probability/activity/advisory claims.

## 8. Decision owners, evidence, and approval gate

| Role | Decision responsibility |
| --- | --- |
| Data governance lead — owner | Distribution selection, provenance, license, permitted use, and approval record. |
| PHIVOLCS/GeoRiskPH data steward | Official artifact, schema, attribution, cadence, coverage, and written authorization. |
| Legal/licensing reviewer | Public display, storage, derivation, export, attribution, and renewal obligations. |
| Hazard-science lead | Fault-distance framing and any future distance-to-score policy. |
| Geospatial engineering lead | CRS, geometry, PostGIS validation, spatial query, and regression evidence. |
| Product manager | Public wording, screening limitation, coverage, and rollout boundary. |

### Required evidence

- Written PHIVOLCS/GeoRiskPH confirmation of the exact distribution and permitted machine/public use.
- License, DUA, memorandum, or equivalent terms; required attribution and export/redistribution limitations.
- Dataset/schema sample, data dictionary, coverage and scale/resolution statement, cadence/SLA, steward, and change-notice process.
- Artifact checksum/hash process, versioning scheme, acceptance/rollback procedure, and approved maximum staleness.
- PostGIS geometry/index/query-plan and spatial-fixture evidence using the accepted artifact.
- Hazard-science approval for any threshold, band, curve, or public risk-language beyond distance/provenance.

### Approval acceptance criteria

- The approval names one licensed, supported, reproducible source artifact/service and a named steward/escalation route.
- The source passes provenance, coverage, CRS, geometry, license, checksum, and schema validation.
- Public display and export use exactly approved attribution and limits.
- Distance outputs are source/version-bound and reproduce from approved spatial fixtures.
- No score curve, rupture/activity inference, connector, ingestion, or source enablement exists without separate accepted implementation work and scientific approval.

### Effective gate and implementation effect

- This gate applies before any active-fault onboarding, source connector, schema/migration, map layer, public display, or scoring implementation ticket.
- `active_fault` remains `out_of_coverage` or `unavailable` until written source authorization and all listed evidence are accepted. Approvals 3–5 also remain implementation blockers.

## 9. Recorded Approval 2 decisions

1. **Approved:** Do not use any current public PHIVOLCS/GeoRiskPH endpoint for production vector ingestion, scoring, or public fault-proximity display without explicit written authorization and a supported data contract.
2. **Approved:** Contact `georisk@phivolcs.dost.gov.ph` to request an approved vector source, license/terms, attribution, data steward, refresh cadence, coverage, and permitted public and derivative use.
3. **Approved:** Until the above is received and approved, `active_fault` remains unavailable/out_of_coverage. Missing fault data must never appear low risk, safe, inactive, or as an earthquake probability assessment.
4. **Approved:** Enablement requires an approved source artifact/version, CRS and geometry validation, record-level provenance, license approval, freshness evidence, and PostGIS spatial regression testing before a fault layer is enabled.
5. **Approved:** If enabled later, public output is limited to authoritative distance/proximity facts with clear source, freshness, uncertainty, and “screening information, not an official advisory” disclosure. Do not infer fault activity, rupture probability, recurrence, or safety conclusions.
6. **Approved:** Any distance-to-risk curve, weighting, or contribution to a public risk score is deferred until separately reviewed and approved by the responsible scientific authority.

**Final status:** Approval 2 policy is approved with implementation blockers. No endpoint or artifact is approved; written source authorization, source-specific evidence, and Approvals 3–5 remain required before Sprint 1 implementation.
