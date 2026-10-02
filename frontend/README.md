# ResilienceMap AI frontend

Next.js 16 (App Router) with React 19, TypeScript, Tailwind CSS and MapLibre. Deployed to Vercel
(root directory `frontend`) at <https://resiliencemapai.online>; it talks to the FastAPI backend on Render.

## Run it

```bash
npm ci
cp .env.example .env.local     # then set NEXT_PUBLIC_API_URL (http://localhost:8000 for a local backend)
npm run dev                    # http://localhost:3000
```

## Check it

```bash
npm test                       # Node's built-in runner over tests/*.test.mjs (pure helpers, no browser)
npx tsc --noEmit
npm run lint
npm run build                  # next build --webpack
```

## Environment

`NEXT_PUBLIC_*` variables are public and inlined at **build** time (a change needs a new deployment); flags are read by
their literal name in `lib/feature-flags.ts`. Server-only variables (`OPENWEATHERMAP_API_KEY`, `ADMIN_SHARED_SECRET`) are
never sent to the browser. Never commit values. The full list, with purpose and secret vs config, is
[`../docs/ENVIRONMENT.md`](../docs/ENVIRONMENT.md); safe defaults are in `.env.example`.

## Where things are

* `app/` routes; `components/map/` the map and the risk panel (`RiskSummaryWidget.tsx`, `FloodFlagButton.tsx`)
* `lib/flood-evidence.ts`, `lib/flood-indicator.ts` satellite flood helpers: the Flood row's evidence line and score
  (satellite-observed, not an official flood map), see [`../docs/FLOOD_CAPTURE.md`](../docs/FLOOD_CAPTURE.md)
* `lib/assessment-adapter.ts` turns the registry-driven `/api/assessments` response into the panel's model
* Operations (migrations, sync, rollback, known limits): [`../docs/OPERATIONS.md`](../docs/OPERATIONS.md)
