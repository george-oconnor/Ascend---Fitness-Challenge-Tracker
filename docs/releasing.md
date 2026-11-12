# Releasing the iOS app

Four GitHub Actions workflows handle checks, over-the-air (OTA) updates and builds. Every change reaches your own test phone first, and only goes to App Store users when you promote it. Promoting resends the update you tested; nothing is rebuilt.

| Workflow | When it runs | What it does |
|---|---|---|
| **Mobile checks** | Every PR that touches the app | Type-check and lint, as a ratchet: fails only if a change adds errors beyond `.github/quality-baseline.json`. Also confirms the profiles used for promotion share the same `EXPO_PUBLIC_*` settings. |
| **Mobile OTA update** | Every push to `main` that changes app JavaScript (or run by hand) | Publishes an EAS Update to the **`internal`** channel. Only internal-profile builds receive it, never App Store users. Skipped automatically if the push changes native code or config. |
| **Mobile promote update** | By hand | Republishes the tested update, unchanged, to `production` and `testflight`, the channels App Store builds listen on. |
| **Mobile build iOS** | By hand | Builds an `.ipa` (production, testflight or internal profile) and, optionally, submits it to TestFlight. You choose where it builds (see below). |

| Profile in `eas.json` | Update channel | Who gets it |
|---|---|---|
| `internal` | `internal` | Your test phones (installed directly, not from the App Store) |
| `production` / `testflight` | `production` / `testflight` | App Store and TestFlight users |

## Typical flow

1. **JavaScript-only fix:** merge to `main` → "Mobile OTA update" publishes it to `internal` → open Ascend on your test phone (an internal build) to check it → run **Mobile promote update** → App Store users get it the next time they open the app.
2. **Native change** (new native module, `app.json`, `app.config.js`, `eas.json`, `package.json`, `modules/`, `patches/`, or a new app version): run **Mobile build iOS** with profile `production` → it uploads to TestFlight → release it in App Store Connect as usual.

The `server/` folder (the Strava token proxy) is a separate Vercel project and isn't touched by these workflows.

**Which version am I on?** The bottom of the Settings screen shows e.g. **Ascend 2.1.1 (3) · update 12 · 4670153**: the app version and build, then the update number (the "Mobile OTA update" run that published it, also shown in that run's summary) and its commit. Promoting keeps the same number, so the App Store build shows it too. "built-in" means the app hasn't downloaded an update yet; close and reopen it (an update downloads on one launch and applies on the next). Sentry events carry the same details as tags (`update.number`, `update.commit`, `update.channel`, `update.id`), so you can filter errors by update, e.g. `update.number:12`.

OTA updates only reach builds with the **same app version** (`runtimeVersion` policy `appVersion`, currently 2.1.2). After bumping `version` in `app.json`, ship a build first, and rebuild your `internal` test phone too: a phone on the old version stops receiving updates. The `version` must also be higher than the one live on the App Store, or Apple rejects the upload. Builds made before this setup (2.1.1 build 2 and earlier) don't include `expo-updates`, so they never receive updates.

## Where builds run

Pick **where** when you run "Mobile build iOS":

| Option | Cost | Notes |
|---|---|---|
| `eas-cloud` | Your Expo plan's build quota | Simplest. The job ends immediately; follow the build on expo.dev. Auto-submits when done. |
| `github-macos` | Private-repo Actions minutes, counted 10× for macOS (about 8–10 builds a month on the free 2,000 minutes) | Runs `eas build --local` on GitHub's Mac with the latest stable Xcode. The `.ipa` is kept as an artifact for 7 days. |
| `my-mac` | Free | Your own Mac as a self-hosted runner. It must be on and running the runner (setup below). |

Build numbers are managed by EAS (`appVersionSource: remote` with `autoIncrement`), so no more "bump build number" commits. The `buildNumber` in `app.json` is ignored.

## One-time setup

1. **Expo access token:** on expo.dev, go to Account settings → Access tokens and create one (ideally for a robot user with access to this project). Add it to GitHub (Settings → Secrets and variables → Actions) as the secret **`EXPO_TOKEN`**.
2. **Remote build number:** on your Mac, run `npx eas-cli build:version:set --platform ios` and enter the last build number you uploaded (2, for 2.1.1). Setting it explicitly avoids a collision on the first remote-numbered build.
3. **A test phone on the `internal` channel:** register the phone with `npx eas-cli device:create`, then install an internal-profile build (run "Mobile build iOS" with profile `internal` and `eas-cloud`, or build it locally).
4. **First App Store build with updates:** run "Mobile build iOS" with profile `production`. This is the first build containing `expo-updates`, so it's the first that can receive promoted updates.
5. **Optional, approval before promoting:** in GitHub, go to Settings → Environments → `app-store` → Required reviewers, so "Mobile promote update" waits for your click.
6. **Optional, your Mac as a runner:**
   1. In GitHub, go to Settings → Actions → Runners → **New self-hosted runner** → macOS, and follow the commands it shows.
   2. Keep the default labels (`self-hosted`, `macOS`).
   3. Run `bash scripts/setup-local-ios-build.sh` once on that Mac.
   4. Start the runner with `./run.sh` when you want to build, or install it as a service.

   This is only safe because the repo is private: never attach a self-hosted runner to a public repo.

## Notes

- **Settings in updates:** the OTA bundle is built with the `internal` profile's `env` from `eas.json` (shared through `_base`), via `scripts/ci/eas-profile-env.mjs`, plus EAS "production" environment variables. If you add an `EXPO_PUBLIC_*` value, put it in `_base` so `internal`, `testflight` and `production` stay alike, or promotion will refuse to run.
- **Sentry environment:** because one bundle serves every channel, `lib/sentry.ts` picks the environment from the build's update channel at runtime (`production` → production, `testflight`/`internal` → staging) rather than from `EXPO_PUBLIC_BUILD_PROFILE`, which only the `development` profile still sets.
- **CloudKit:** the `internal` profile uses the **Production** CloudKit environment, like the App Store builds, so your test phone sees real data and tests the same schema users get. Deploy schema changes to Production before promoting an update that needs them.
- **Quality baseline:** when you fix TypeScript or ESLint errors, lower the baseline in the same PR with `node scripts/ci/quality-ratchet.mjs --update`.
- **Android:** this setup is iOS only. Android would need `--platform android` on the build, update and promote commands, plus Android submit profiles.
- **Pinned CLI:** each workflow pins `eas-cli@27.2.0` in its `env`, so CLI releases can't break a release. Bump it deliberately.
