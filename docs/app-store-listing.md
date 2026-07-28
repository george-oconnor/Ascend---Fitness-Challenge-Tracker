# App Store listing copy — Ascend

Draft copy for App Store Connect's listing fields. Character limits noted
where Apple enforces them; trim/adjust to taste before pasting in.

**Locale: `en-GB`** (English (U.K.)) — this is the app's actual primary
locale in App Store Connect, not `en-US`. `store.config.json` uses the
`en-GB` key to match.

**Do not use the phrase "75 Hard"** anywhere in listing copy — it's a
protected/trademarked term. "75-day" (as a plain duration) is fine.

---

## App Name (30 char max)

```
Ascend - Challenge Tracker
```
(26 characters)

## Subtitle (30 char max)

```
Transform Through Daily Habits
```
(30 characters)

## Promotional Text (170 char max — editable without a new build)

```
Now powered by iCloud — your data stays private in your own account, synced
across your devices. Connect Strava for accurate workout types. No ads.
```
(140 characters)

## Description (4000 char max)

```
Ascend is your daily companion for building discipline — track the habits
that matter one day at a time, and watch your streak grow.

WHAT YOU CAN TRACK
• Daily workouts (two-a-day support)
• Water intake
• Diet adherence
• Steps (auto-synced from Apple Health)
• Reading
• Progress photos
• Weight
• Mood
• Sleep
• Skincare
• Cycle tracking

BUILT AROUND YOUR CHALLENGE
Set up your own challenge — choose which rules to track, set your goals, and
pick your duration. Running the standard 75-day format, or something custom?
Ascend adapts to whatever challenge you're running.

APPLE HEALTH INTEGRATION
Connect Apple Health once and Ascend automatically pulls in your steps,
workouts, sleep, and water intake — no manual double-entry.

STRAVA INTEGRATION
Connect Strava and your workouts sync in with their correct activity type
automatically — no more re-entering runs, rides, or lifts by hand.

YOUR DATA, YOUR ICLOUD
Ascend stores your data in your own private iCloud account, not on a company
server. Sign in with Apple — no usernames, no passwords, no account to leak.
Nobody but you can see your logs, not even us.

STAY MOTIVATED
Track your streak, review weekly and monthly analytics, and earn badges as
you hit milestones. See exactly how consistent you've been at a glance.

Ascend is ad-free, doesn't sell your data, and doesn't track you across other
apps or websites.
```

## What's New / Release Notes (current version: 2.1.0)

```
2.1.0 adds background health syncing — Ascend now checks in periodically and
notifies you when you hit a new milestone, even when the app is closed. Also
fixed: duplicate entries no longer appear in your activity feed when editing
a workout, and background notifications for Strava and Apple Health are more
reliable.
```

## Keywords (100 char max, comma-separated, no spaces after commas)

```
habit tracker,challenge,discipline,fitness,workout log,streak,strava,water intake,goals,consistency
```
(99 characters)

## Support URL

```
https://george-oconnor.github.io/Ascend---Fitness-Challenge-Tracker/support.html
```
(confirm this matches wherever `docs/support.html` is actually hosted — see note below)

## Marketing URL (optional)

Left blank in `store.config.json` — the GitHub Pages site's root
(`.../Ascend---Fitness-Challenge-Tracker/`) 404s, there's no `docs/index.html`.
Add one and set this field if you want a public landing page later.

## Privacy Policy URL

```
https://george-oconnor.github.io/Ascend---Fitness-Challenge-Tracker/privacy.html
```
(same hosting caveat as above)

---

## Notes / things to double check before submitting

- **Hosting URLs verified 2026-07-27**: both `privacy.html` and `support.html`
  return HTTP 200 at the `github.io` URLs above via GitHub Pages. The URLs in
  this doc and in `store.config.json` are confirmed correct.
- **`docs/support.html` cleanup is done** — no Google Fit or "our servers"
  language remains; it correctly describes Sign in with Apple + iCloud storage
  and includes the old-account migration FAQ.
- **Screenshots**: still not addressed. App Store Connect requires screenshots
  per device size (6.7", 6.5", iPad if supporting tablet). Since the sign-in
  flow changed (no more email/password screens) and Strava is a new feature,
  any existing screenshots need retaking — EAS Metadata reads these from local
  files (see `store.config.json`'s `screenshots` field), so they need to exist
  on disk before running `eas metadata:push`.
- **App Privacy questionnaire** (the separate data-collection form in App
  Store Connect, not this listing copy) — see `docs/app-review-notes.md` for
  what to select there. EAS Metadata does not cover this field; it must still
  be set manually in App Store Connect's web UI.
- **`eas.json`'s `ascAppId` was wrong** (fixed 2026-07-28): it pointed at a
  different app entirely (`6756985580`, "Loaded - Personal Budgeting"). The
  correct Ascend app ID is `6757496594`. Double check this before any
  `eas submit` or `eas metadata:push`.
- **`eas metadata:push` has a bug** (tested on eas-cli 21.3.0 and 21.4.0,
  2026-07-28): it fails with "missing required attribute 'versionString'"
  when creating a version-level localization (Description, Keywords, Promo
  Text, What's New, Support/Marketing URL) for a locale that doesn't already
  have one on the current App Store version. It succeeds for app-level
  fields (Name, Subtitle, categories). Only Name/Subtitle actually update via
  the CLI right now — the version-level fields need to be pasted in by hand
  on the version's page in App Store Connect until this is fixed upstream.
