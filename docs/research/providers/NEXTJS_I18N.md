# Next.js I18n

Recommendation: `next-intl` for Next App Router static dictionaries, locale-aware formatting and server/client boundaries; official docs: https://next-intl.dev/docs/getting-started/app-router. Use explicit English/Filipino resources first, a fallback locale, `html lang`, locale-safe dates/numbers, and deep-link preservation. No LLM/static text translation. Risks are route migration, missed keys and hydration inconsistency; mitigate with build-time key checks and locale smoke tests. Recommendation: IMPLEMENT only after P0 event work, with no dynamic translation engine.
