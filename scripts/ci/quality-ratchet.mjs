#!/usr/bin/env node
/**
 * Quality ratchet for the iOS app: fails if a change adds TypeScript or ESLint
 * errors beyond the recorded baseline (.github/quality-baseline.json). The
 * codebase has existing errors, so a strict check would always be red; this
 * lets the counts only go down. When you fix some, lower the baseline in the
 * same PR (the check tells you the new numbers).
 *
 *   node scripts/ci/quality-ratchet.mjs            # check
 *   node scripts/ci/quality-ratchet.mjs --update   # rewrite the baseline to today's counts
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const BASELINE = new URL("../../.github/quality-baseline.json", import.meta.url);

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    return (err.stdout || "") + (err.stderr || ""); // non-zero exit is expected while errors exist
  }
}

const tscOut = run("npx tsc --noEmit --pretty false");
const tscErrors = (tscOut.match(/error TS\d+/g) || []).length;

const lintJson = run("npx eslint . --format json");
let lintErrors;
try {
  lintErrors = JSON.parse(lintJson.slice(lintJson.indexOf("["))).reduce((n, f) => n + f.errorCount, 0);
} catch {
  console.error("Could not parse ESLint output:\n" + lintJson.slice(0, 2000));
  process.exit(2);
}

const current = { tsc_errors: tscErrors, eslint_errors: lintErrors };
if (process.argv.includes("--update")) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
  console.log("Baseline updated:", current);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
let failed = false;
for (const [key, label] of [["tsc_errors", "TypeScript errors"], ["eslint_errors", "ESLint errors"]]) {
  const now = current[key];
  const was = baseline[key];
  if (now > was) {
    failed = true;
    console.log(`::error::${label} went up: ${was} -> ${now}. Fix the new ones (run 'npx tsc --noEmit' / 'npx expo lint').`);
  } else if (now < was) {
    console.log(`::notice::${label} went down: ${was} -> ${now}. Lower the baseline: node scripts/ci/quality-ratchet.mjs --update`);
  } else {
    console.log(`${label}: ${now} (baseline ${was})`);
  }
}
if (failed && tscErrors > 0) {
  console.log("\nTypeScript output:\n" + tscOut.split("\n").filter((l) => l.includes("error TS")).slice(0, 80).join("\n"));
}
process.exit(failed ? 1 : 0);
