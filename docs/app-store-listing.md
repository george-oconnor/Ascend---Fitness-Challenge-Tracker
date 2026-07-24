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
across your devices. Sign in with Apple, no passwords, no ads.
```
(136 characters)

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
75hard,habit tracker,challenge,discipline,fitness,workout log,streak,water intake,health,goals
```
(check exact length before submitting — trim if over 100)

## Support URL

```
https://george-oconnor.github.io/Ascend---Fitness-Challenge-Tracker/support.html
```
(confirm this matches wherever `docs/support.html` is actually hosted — see note below)

## Marketing URL (optional)

Leave blank, or point at the same GitHub Pages site if you want a public landing page.

## Privacy Policy URL

```
https://george-oconnor.github.io/Ascend---Fitness-Challenge-Tracker/privacy.html
```
(same hosting caveat as above)

---

## Notes / things to double check before submitting

- **Verify the actual hosting URL** for `docs/*.html` — this repo's `git remote`
  points at `github.com/george-oconnor/Ascend---Fitness-Challenge-Tracker`, so
  if GitHub Pages is enabled for it, the URLs above should be right, but
  confirm rather than assume.
- **Screenshots**: not addressed here — App Store Connect requires new
  screenshots per device size. Since the sign-in flow and possibly some
  screens changed (no more email/password screens), any existing screenshots
  showing the old login UI need retaking.
- **`docs/support.html` still needs a cleanup pass** — it currently mentions
  Google Fit integration (this is an iOS-only app now, no Android/Google Fit
  code exists) and says data is stored "on our servers" (no longer true, see
  the rewritten `privacy.html`). Not touched yet — flagging it since it's part
  of the same public-facing doc set and the App Store listing links to it.
- **App Privacy questionnaire** (the separate data-collection form in App
  Store Connect, not this listing copy) — see `docs/app-review-notes.md` for
  what to select there.
