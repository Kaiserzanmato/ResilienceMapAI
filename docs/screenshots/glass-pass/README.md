# Glass design pass — before/after

`before/` is `main` at `0bd9cdd` (the merged responsive/overlap fix, pre-glass-pass).
`after/` is this branch. Captured locally (no backend running), desktop width (~1323px) —
the browser-automation tool's window resize didn't take effect in this session, so mobile-width
captures aren't included here. Mobile layout (including the Insights dialog's full-screen phone
behavior) is instead covered by the Playwright suite (`e2e/layering.spec.ts`,
`e2e/persona-and-motion.spec.ts`), which runs at 360–1920px and on iPhone 14 / Pixel 7 / iPad
device emulation.

| Pair | What it shows |
| --- | --- |
| `home.jpg` | Header/footer: hardcoded navy gradient + `shadow-lg` → tokenized `.glass-strong` surface |
| `map-layers-evac-toggle.jpg` | `🏫 Show Nearest Evacuation Centers` emoji → `LifeBuoy` lucide icon |
| `settings.jpg` | Duplicate "Default persona" card (with emoji) removed; read-only current-persona line added |
| `persona-menu.jpg` | Persona dropdown: raw emoji rows → 32px rounded-square glass icon tiles, accent-tinted on the selected row |

Not captured here: the Insights dialog / mobile bottom sheet, since exercising it needs a
selected location + assessment data that this local frontend-only dev server has no backend to
provide. Its behavior (overlap-free positioning, focus trap, Esc, 44px tap target, reduced
motion) is verified instead by the Playwright suite against a mocked backend.
