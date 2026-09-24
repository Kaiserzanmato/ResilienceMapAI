# Changelog

All notable changes to ResilienceMap AI are logged here, newest first. This
file starts from 2026-08-08; for full history before that, see `git log` and
the narrative "Recent fixes" section in `README.md`, which already covers
the Aug 6–7 geocoding-gateway and dashboard/globe/weather work in detail.

Format: `[commit] type: summary`, followed by what changed and why when it
isn't obvious from the summary alone.

## 2026-08-08

- **[`83f48bd`] fix: add visible scroll to risk summary overlay hazard list**
  `RiskSummaryWidget.tsx` (the panel shown after clicking a location on
  `/map`) had no height cap, so on short viewports its bottom — including
  the Insights/Ask AI/Export/Share buttons — was pushed off-screen with no
  way to reach it. The panel now caps its height to the viewport, pins the
  header and action-button footer outside the scroll region, and makes only
  the hazard list / main drivers / nearest-zone section scroll. Added a
  `.scroll-visible` utility (`frontend/app/globals.css`) so the scrollbar
  itself is clearly visible against the dark theme rather than relying on
  the site's default thin/near-transparent one. Verified live on
  `resiliencemapai.online` by fetching the deployed CSS/JS bundles and
  confirming both the `.scroll-visible` rule and the `overflow-y-auto`
  hazard-list markup are present.
  Docs updated: `README.md`, `PRD.md`, `ARCHITECTURE.md`,
  `TECHNICAL_DOCUMENTATION.md`, `DOCUMENTATION_INDEX.md`.
