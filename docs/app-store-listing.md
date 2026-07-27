# App Store listing copy — Ascend

Draft copy for App Store Connect's listing fields. Character limits noted
where Apple enforces them; trim/adjust to taste before pasting in.

---

## App Name (30 char max)

```
Ascend: 75 Hard Tracker
```
(23 characters)

## Subtitle (30 char max)

```
Daily habit & challenge log
```
(27 characters)

## Promotional Text (170 char max — editable without a new build)

```
Now powered by iCloud — your data stays private in your own account, synced
across your devices. Connect Strava for accurate workout types. No ads.
```
(140 characters)

## Description (4000 char max)

```
Ascend is your daily companion for the 75 Hard challenge — build discipline
one day at a time by tracking the habits that matter, and watch your streak
grow.

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
pick your duration. Not doing the strict 75-day version? Customize it to fit
whatever challenge you're running.

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

## Keywords (100 char max, comma-separated, no spaces after commas)

```
75hard,habit tracker,challenge,discipline,fitness,workout log,streak,strava,water intake,goals
```
(96 characters)

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
