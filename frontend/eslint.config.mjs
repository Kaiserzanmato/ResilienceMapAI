import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Next.js inlines NEXT_PUBLIC_ variables only for literal names; a computed
    // lookup is undefined in the browser (see lib/feature-flags.ts).
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[computed=true][object.type='MemberExpression'][object.object.name='process'][object.property.name='env']",
          message: "Read env vars by literal name (process.env.NEXT_PUBLIC_X); computed lookups are not inlined into the browser bundle.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated vendor files copied from node_modules by scripts/copy-maplibre-worker.mjs.
    "public/maplibre/**",
  ]),
]);

export default eslintConfig;
