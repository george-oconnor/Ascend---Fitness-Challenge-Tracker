# App Review notes — Ascend (CloudKit release)

Paste the relevant parts into App Store Connect. The **App Review Information →
Notes** field is the important one; the demo-account fields don't apply (there
is no username/password — see below).

---

## App Review Information → Notes

```
HOW TO SIGN IN
This app uses "Sign in with Apple" as its only sign-in method — there is no
username/password and no demo account is required. Please sign in with any
Apple ID.

ICLOUD IS REQUIRED
All user data (challenges, daily logs, cycle tracking, activity history,
badges) is stored privately in the user's own iCloud (CloudKit), not on our
servers. Before signing in, please make sure the device is signed into
iCloud (Settings → [your name] → iCloud). If iCloud is not available, the
app shows a screen asking you to sign in to iCloud — this is expected.

SEEING A POPULATED APP
Because data lives in each user's private iCloud, a brand-new sign-in starts
empty. To review the app, sign in with Apple, then set up a challenge from
the onboarding flow (choose which of the 75 Hard rules to track, set your
goals) and log a few days manually from the home screen.

ACCOUNT DELETION
Account deletion is available in Profile → "Delete Account". It permanently
removes all of the user's data from iCloud.

WHAT THE APP DOES
Ascend is a 75 Hard style challenge tracker: track daily steps, water,
workouts, diet, reading, progress photos, mood, sleep and more against a
custom challenge you configure. It integrates with Apple Health for steps,
workouts, sleep and water where available. It is ad-free and does not track
users.
```

---

## TestFlight → "What to Test" (for external testers)

```
Now powered by iCloud (CloudKit) instead of our own servers.

- Sign in with Apple (make sure you're signed into iCloud on the device).
- New here? Set up your challenge from onboarding and start logging.
- Existing Ascend user? On the sign-in screen tap "Migrating from an old
  account?" to bring your old challenges, daily logs, cycle tracking,
  activity history and badges across to iCloud.
- Please report anything that looks wrong, especially around dates/streaks
  or after importing an old account.
```

---

## Guideline notes (for our reference)

- **4.8 Sign in with Apple** — it's the only login method, so this is satisfied.
- **5.1.1(v) Account deletion** — Profile → Delete Account (CloudKit zone wipe,
  which now actually deletes the user's data — the old Appwrite-backed
  `deleteUserAccount` only removed the auth record, not the documents).
- **Export compliance** — `ITSAppUsesNonExemptEncryption: false` is set, so no
  encryption questionnaire on upload.
- **Demo account fields** — leave blank / N/A; sign-in needs only an Apple ID.
- **HealthKit** — existing HealthKit entitlements/usage strings are unchanged
  by this migration; only the storage/auth backend changed.
- Reviewers **must** be signed into iCloud or the app will (correctly) gate at
  the "sign in to iCloud" screen — call this out so it isn't mistaken for a bug.
- **App Privacy (Data Collection) questionnaire** in App Store Connect needs
  updating to match the new backend — see below.

## App Privacy questionnaire (App Store Connect → App Privacy)

This is the "nutrition label" form, separate from the Notes field above —
it needs updating now that Appwrite is gone. Based on what the app actually
collects (see `docs/privacy.html` for the full accounting):

- **Contact Info → Name, Email Address**: Collected (optionally, via Sign in
  with Apple), linked to the user's identity, not used for tracking.
- **Health & Fitness → Health**: Collected (steps/workouts/sleep/water via
  HealthKit, only with permission), linked to identity, not used for tracking.
- **User Content → Other User Content**: Collected (daily logs, cycle
  tracking, activity history — all app-generated content), linked to
  identity, not used for tracking.
- **Diagnostics → Crash Data, Performance Data**: Collected (Sentry), can be
  linked to identity depending on Sentry config, not used for tracking.
- Mark **Data Used to Track You**: No — there is no ad network or
  cross-app/cross-site tracking.
- Storage note if asked: data is stored in the user's private iCloud
  (CloudKit), not on developer-operated servers.

## Version/build reference

Current TestFlight build under review: `1.0.3` / build `2`. If a fresh build
is cut, bump the build number here and in `app.json` before resubmitting —
App Store Connect rejects a repeat of the same version+build pair.
