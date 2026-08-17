# Manual visual QA checklist

Run this checklist from a normal macOS Terminal.app or iTerm session, outside
the restricted agent sandbox. Do not start release work until the evidence
table is complete and its screenshots are available for review.

## Start local services

In terminal 1:

```bash
cd /Users/oliveripsioco/ResilienceMapAI/backend
./.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In terminal 2:

```bash
cd /Users/oliveripsioco/ResilienceMapAI/frontend
npm run dev -- --hostname 127.0.0.1 --port 3001
```

In terminal 3, verify the services before opening a browser:

```bash
curl -fsS http://127.0.0.1:8000/health
curl -I http://127.0.0.1:8000/docs
curl -I http://127.0.0.1:3001/map
```

Open `http://127.0.0.1:3001/map`. Do not copy browser cookies, authorization
headers, API keys, or user data into evidence notes or screenshots.

## Viewport and state matrix

For every viewport below, test portrait orientation. Also test landscape at
375×812 and 768×1024.

| Viewport | AI closed | AI expanded | Light | Dark | High contrast |
| --- | --- | --- | --- | --- | --- |
| 375×812 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 768×1024 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 820×1180 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 1024×768 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 1199×800 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 1200×800 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 1280×800 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 1440×900 | ☐ | ☐ | ☐ | ☐ | ☐ |

## Acceptance checks

- Search is visible, focused, and usable; at tablet widths it never overlaps
  the open AI panel.
- Risk Summary is shown only in its intended layout state and never collides
  with the AI panel.
- Map controls, telemetry, navigation, footer, and weather-layer controls
  remain reachable and unobstructed.
- No horizontal scrolling, clipped controls, or critical text hidden by
  truncation occurs.
- Keyboard focus order is visible; Escape and close controls work; touch
  targets are usable.
- With selected-location telemetry present, it is visible when AI is closed
  and hidden when AI is open.
- Resize the desktop AI panel to its minimum, default, and maximum widths.
- Navigate Dashboard → Map → Dashboard without a hard refresh; verify the
  animated globe appears on the non-map route.
- In browser DevTools, Console has no errors and Network has no failed
  first-party, API, or map-tile requests.

## Evidence table

Record only sanitized observations. Use screenshot filenames, not embedded
screenshots or browser exports.

| Viewport | Orientation | AI state | Theme | Pass/fail | Observed issue | Screenshot filename | Console/network notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Desktop (exact CSS viewport not recorded) | Landscape | Collapsed | Dark | Partial | Weather nav label wrapped; selected map point was not distinguished from the prioritized area. | `CleanShot 2026-08-17 at 16.08.37@2x.png` | Console warnings referenced `contentscript.js`; treated as browser-extension output, not a first-party app failure. |
| Desktop (exact CSS viewport not recorded) | Landscape | Collapsed | Dark | Partial | Forecast panel had no collapse control; Zoom.Earth card covered the map zoom controls. | `CleanShot 2026-08-17 at 16.08.57@2x.png` | Console warnings referenced `contentscript.js`; no first-party application error was evidenced. |
| Desktop (exact CSS viewport not recorded) | Landscape | Expanded | Dark | Partial | Local dev server at `127.0.0.1:3001` was unavailable when captured; no application-layout conclusion can be drawn. | `CleanShot 2026-08-17 at 16.36.24@2x.png` | Connection refused; not an app Console/API failure. |
| Desktop (exact CSS viewport not recorded) | Landscape | Expanded | Dark | Partial | Sidebar content and the separate legend could occupy the same lower-left region at short heights. | `CleanShot 2026-08-17 at 16.36.37@2x.png`, `CleanShot 2026-08-17 at 16.36.46@2x.png` | Dev route tooling was visible; no clean Console/Network result was captured. |
| Desktop (exact CSS viewport not recorded) | Landscape | Expanded | Dark | Partial | Zoom.Earth promotional card was visible beneath the AI panel; selected-point telemetry requires the same AI-open suppression. | `CleanShot 2026-08-17 at 16.37.29@2x.png` | External QA confirmed `/api/weather-current` and `/api/weather-tiles/*` returned HTTP 200. |
| Desktop (exact CSS viewport not recorded) | Landscape | Not applicable | Light | Partial | A prior development overlay reported a weather-tile 503; this is inconclusive against the later confirmed HTTP 200 responses. | `CleanShot 2026-08-17 at 16.37.36@2x.png` | Requires a fresh clean-browser Network capture before treating it as a current API defect. |
| Desktop (exact CSS viewport not recorded) | Landscape | Expanded | Dark | Pass | Map sidebar cards stack without overlapping the Risk Legend; selected-location distinction remains visible with the AI panel open. | `CleanShot 2026-08-17 at 17.05.22@2x.png` — `/Users/oliveripsioco/Library/Application Support/CleanShot/media/media_wtzqgMrp66/CleanShot 2026-08-17 at 17.05.22@2x.png` | No Console or Network panel was included in this capture. |
| Desktop (exact CSS viewport not recorded) | Landscape | Expanded | Dark | Pass | Weather forecast controls remain available while the AI panel is open; the Zoom.Earth link-out card is not visible beneath it. | `CleanShot 2026-08-17 at 17.06.07@2x.png` — `/Users/oliveripsioco/Library/Application Support/CleanShot/media/media_DduUvUy5GP/CleanShot 2026-08-17 at 17.06.07@2x.png` | Endpoint verification: `/api/weather-current` and `/api/weather-tiles/*` returned HTTP 200. No sensitive request data recorded. |
| Desktop (exact CSS viewport not recorded) | Landscape | Expanded | Dark | Pass | The collapsed forecast control remains reachable with the AI panel open; no secondary weather widget is visibly obscured by it. | `CleanShot 2026-08-17 at 17.06.18@2x.png` — `/Users/oliveripsioco/Library/Application Support/CleanShot/media/media_oMsl20CPLW/CleanShot 2026-08-17 at 17.06.18@2x.png` | No Console or Network panel was included in this capture. |

## Release gate

Return completed evidence and screenshots for review before any commit,
GitHub push, Vercel/Render deployment, or documentation claim that visual QA
is complete.

## Current evidence status

Manual QA completion was reported on 2026-08-17. The evidence table records
only the supplied browser captures and their directly observable results.
Mobile, tablet, theme, keyboard, navigation, globe, clean Console, and clean
Network checks were reported as passed, but no additional screenshot filename
or granular observation was supplied; this document deliberately does not
invent either. Sanitized endpoint evidence confirms `/api/weather-current` and
`/api/weather-tiles/*` returned HTTP 200. No secrets, cookies, authorization
headers, or request bodies are recorded here.

## Production release outcome

PR #5 merged to `main` as `26a563e5c4e35e22c89ae5a994aac6f5ec614a7d`.
The first Production deployment's current-weather proxy returned HTTP 401 with
an upstream invalid-key diagnostic, so the rollout was stopped and Vercel was
promoted back to the immediately previous healthy deployment. No secret value
was read or recorded.

After the Production key was corrected and `main` redeployed, the Vercel
Production deployment was Ready. Final sanitized HTTP checks passed:

| Target | Result | Note |
| --- | --- | --- |
| `/map` | HTTP 200 | Route availability check. |
| `/weather` | HTTP 200 | Route availability check. |
| `/api/weather-current` | HTTP 200 | Corrected-key proxy verification. |
| `/api/weather-tiles/precipitation_new/3/6/3` | HTTP 200 | Representative forecast-tile proxy verification. |
| Render `/health` | HTTP 200 | Passed after one retry for the documented free-tier cold start. |

The final production endpoint checks contain no Console/Network export or
additional screenshot artifact. The manual QA evidence limits above still
apply.

## Security scan record

Gitleaks found two historical candidates during a redacted Git-history scan.
Both were independently classified as false positives without exposing their
contents:

| Location | Classification | Rationale |
| --- | --- | --- |
| `DEEPSEEK_SETUP.md:205` (`fcc0cae`) | Documentation placeholder | A 12-character, known API-key placeholder in a sample curl header. |
| `backend/tests/test_ai_guardrails.py:24` (`bafcca9`) | Test fixture | The value is deliberately passed to the output-redaction guardrail test. |

No scanner rule has been disabled or allowlisted. Re-run the redacted
worktree-diff and Git-history scans before release.
