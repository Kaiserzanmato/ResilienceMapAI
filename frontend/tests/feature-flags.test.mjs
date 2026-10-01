// Run with `npm test` (node:test; no extra dependencies).
//
// Guards against the bug where every NEXT_PUBLIC feature flag was read with a
// computed lookup (`process.env[name]`). Next.js only inlines NEXT_PUBLIC_
// variables for literal references, so in the browser that lookup was always
// undefined and each flag silently used its default, whatever Vercel had set.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const flagsFile = join(root, "lib", "feature-flags.ts");
const source = readFileSync(flagsFile, "utf8");
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""); // ignore comments

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(name) ? [path] : [];
  });
}

test("no source file reads process.env with a computed key", () => {
  const offenders = [];
  for (const dir of ["app", "components", "lib"]) {
    for (const file of sourceFiles(join(root, dir))) {
      const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      if (/process\.env\s*\[/.test(text)) offenders.push(relative(root, file));
      if (/(?:const|let|var)\s*\{[^}]*\}\s*=\s*process\.env\b/.test(text)) offenders.push(relative(root, file));
    }
  }
  assert.deepEqual(offenders, [], "use the literal process.env.NEXT_PUBLIC_NAME so Next.js can inline it");
});

test("every flag reads its own literal NEXT_PUBLIC_ENABLE_* variable", () => {
  const entries = [...code.matchAll(/^\s*([A-Z_]+):\s*flag\((.*)\),?\s*$/gm)];
  assert.ok(entries.length >= 12, `expected the FLAGS entries to be found, got ${entries.length}`);
  for (const [, key, args] of entries) {
    const literal = args.match(/^process\.env\.(NEXT_PUBLIC_ENABLE_[A-Z_]+)\s*(?:,|$)/);
    assert.ok(literal, `${key} must call flag(process.env.NEXT_PUBLIC_ENABLE_..., default); got flag(${args})`);
    assert.equal(
      literal[1],
      `NEXT_PUBLIC_ENABLE_${key}`,
      `${key} should read NEXT_PUBLIC_ENABLE_${key}, not ${literal[1]}`,
    );
  }
  assert.doesNotMatch(code, /function flag\(\s*name\b/, "flag() takes the value, never a variable name");
});

function evaluate(env) {
  const out = execFileSync(
    process.execPath,
    ["--input-type=module", "-e", `import { FLAGS } from ${JSON.stringify(flagsFile)}; console.log(JSON.stringify(FLAGS));`],
    { env: { PATH: process.env.PATH, ...env }, encoding: "utf8" },
  );
  return JSON.parse(out);
}

test("defaults are unchanged when no variable is set", () => {
  const flags = evaluate({});
  assert.deepEqual(
    Object.entries(flags).filter(([, on]) => on).map(([key]) => key).sort(),
    ["DEEPSEEK_GROUNDED_CONTEXT", "GLOBAL_SOURCE_REGISTRY", "HOME_GLOBE_LOADER", "HUMANITARIAN_LAYER",
      "SOURCE_AUTO_SYNC", "SOURCE_HEALTH_MONITORING", "SYNC_AUDIT_LOGS"],
  );
  assert.equal(flags.FLOOD_CAPTURE, false);
  assert.equal(flags.REALTIME_EVENTS, false);
});

test("a set variable overrides the default, and only the exact string true enables", () => {
  assert.equal(evaluate({ NEXT_PUBLIC_ENABLE_FLOOD_CAPTURE: "true" }).FLOOD_CAPTURE, true);
  assert.equal(evaluate({ NEXT_PUBLIC_ENABLE_FLOOD_CAPTURE: "TRUE" }).FLOOD_CAPTURE, false);
  assert.equal(evaluate({ NEXT_PUBLIC_ENABLE_HUMANITARIAN_LAYER: "false" }).HUMANITARIAN_LAYER, false);
  assert.equal(evaluate({ NEXT_PUBLIC_ENABLE_HUMANITARIAN_LAYER: "" }).HUMANITARIAN_LAYER, false); // set but not "true"
});
