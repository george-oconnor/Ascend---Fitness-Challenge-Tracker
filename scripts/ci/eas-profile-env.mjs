#!/usr/bin/env node
/**
 * Prints the `env` an EAS build profile defines (following `extends`), one
 * KEY=VALUE per line, so CI can publish OTA updates with exactly the same
 * EXPO_PUBLIC_* values that profile's builds were made with.
 *
 *   node scripts/ci/eas-profile-env.mjs internal >> "$GITHUB_ENV"
 *   node scripts/ci/eas-profile-env.mjs internal --same-public-env-as production testflight
 *
 * The second form exits 1 if any EXPO_PUBLIC_* value differs between the
 * profiles: promoting an update from one channel to another is only safe
 * when the JavaScript bundle was built with the same public config.
 */
import { readFileSync } from "node:fs";

const eas = JSON.parse(readFileSync(new URL("../../eas.json", import.meta.url), "utf8"));

function profileEnv(name, seen = new Set()) {
  const profile = eas.build?.[name];
  if (!profile) throw new Error(`No build profile "${name}" in eas.json`);
  if (seen.has(name)) throw new Error(`Circular "extends" at "${name}"`);
  seen.add(name);
  const parent = profile.extends ? profileEnv(profile.extends, seen) : {};
  return { ...parent, ...(profile.env ?? {}) };
}

const publicOnly = (env) =>
  Object.fromEntries(Object.entries(env).filter(([k]) => k.startsWith("EXPO_PUBLIC_")).sort());

const [name, flag, ...others] = process.argv.slice(2);
if (!name) {
  console.error("usage: eas-profile-env.mjs <profile> [--same-public-env-as <profile>...]");
  process.exit(2);
}

if (flag === "--same-public-env-as") {
  const base = publicOnly(profileEnv(name));
  let ok = true;
  for (const other of others) {
    const env = publicOnly(profileEnv(other));
    for (const key of new Set([...Object.keys(base), ...Object.keys(env)])) {
      if (base[key] !== env[key]) {
        console.error(`EXPO_PUBLIC mismatch: ${key} differs between "${name}" and "${other}"`);
        ok = false;
      }
    }
  }
  if (!ok) process.exit(1);
  console.log(`EXPO_PUBLIC_* settings match across: ${[name, ...others].join(", ")}`);
} else {
  for (const [k, v] of Object.entries(profileEnv(name))) {
    if (String(v).includes("\n")) throw new Error(`${k} contains a newline`);
    console.log(`${k}=${v}`);
  }
}
