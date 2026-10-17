# Over-the-air updates (EAS Update)

From version 1.2.0 (Android versionCode 3) the installed app checks Expo's update service when it
opens, downloads a newer JavaScript/asset update in the background and uses it on the **next**
launch. It never waits for the network at launch (fallbackToCacheTimeout 0), never reloads during a
practice, and works offline exactly as before. Settings shows "Ona 1.2.0 · update of <date>" when an
update is running, so the owner can see it arrived.

## What can be shipped as an update

- Screens, animations, copy, rules in TypeScript, images and sounds: yes.
- New or upgraded native modules, config plugins, permissions, icon, splash, app.json native
  settings, Expo SDK upgrades: **no**. These need a new APK.

`runtimeVersion` uses the `appVersion` policy: an update only reaches builds whose `expo.version`
equals the version it was published from. native-runtime.json records the native modules and plugins
of the current runtime; tests/data/native-config.test.cjs fails if they change without it. For a
native change: raise `expo.version` (for example 1.2.0 → 1.3.0) and `android.versionCode`, update
native-runtime.json, and build a new APK. Database migrations still run at startup after an update,
with the same validation, so an update can carry migration 14+ like a new build.

## Publishing (from the owner's PC, through Codex; this cloud workspace cannot reach Expo)

```sh
git pull origin main
npm ci
npm run check
npx eas-cli@latest update --channel preview --platform all --environment preview --message "<what changed>"
```

SDK 57 requires `--environment`. Before publishing, the EAS `preview` environment must contain
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, matching the preview build
profile. Updates do not read that profile's `env` or local `.env` when an EAS environment is selected.
Only the project URL and publishable key belong there; never add server credentials.
See [Expo's environment-variable guidance](https://docs.expo.dev/eas/environment-variables/usage/).

The preview build profile uses channel `preview`; app.json `updates.requestHeaders` names the same
channel for the iPhone build made outside EAS (docs/IOS_SIDELOAD.md). `--platform all` reaches both;
use `--platform android` only while no iPhone build exists. Builds made before 1.2.0 have no update support
and must be replaced once by the 1.2.0 APK. An update that misbehaves can be undone by republishing
the previous commit (`eas update:republish` or a new update from that commit).

## Published updates

### 2026-10-15 — Painted calendar and new interval bell

- Update group: `b3642b6d-0149-4489-af59-17f244359a2a` —
  [Expo dashboard](https://expo.dev/accounts/tripto92/projects/MeditationApp/updates/b3642b6d-0149-4489-af59-17f244359a2a).
- Source commit: `703c8f44c7dfada9b1f8cb088970004045795f0a` (clean main).
- Android, runtime `1.2.0`, channel/branch `preview`, EAS environment `preview`.

Published after clean npm ci, TypeScript/lint, 997 passing tests and all-platform export.
EAS confirmed the runtime and active channel mapping. The owner confirmed installing 1.2.0 (3)
over the old app before publication. Update arrival and native listening remain device checks.

### 2026-10-16 — Breath-counting guide, indigo calendar and reward glow fix

- Update group: `328a10bc-2757-4dca-abd3-6a2668e8d199` —
  [Expo dashboard](https://expo.dev/accounts/tripto92/projects/MeditationApp/updates/328a10bc-2757-4dca-abd3-6a2668e8d199).
- Source commit: `3e6cce1d253beecb5598595210bcee96695d3577` (clean main).
- Android and iOS, runtime `1.2.0`, channel/branch `preview`, EAS environment `preview`.

Published after Node 24.21.0, clean npm ci, TypeScript/lint, 1,003 passing tests and
all-platform export. EAS confirmed both published platforms and the active preview channel's
mapping to this group. Includes the breath-counting guide, indigo twice-a-day calendar marks
and legend, and reward glow colour hardening. Update arrival and the reported Android crash's
resolution remain device checks; no APK was built.

### 2026-10-17 — Prepare interval bell, clean-up and completion moments

- Update group: `afbf351e-78b9-40bc-a90a-9c8937666efa` —
  [Expo dashboard](https://expo.dev/accounts/tripto92/projects/MeditationApp/updates/afbf351e-78b9-40bc-a90a-9c8937666efa).
- Source commit: `f192e21c050bde986388485b8763a0b89ab87f2e` (clean main).
- Android and iOS, runtime `1.2.0`, channel/branch `preview`, EAS environment `preview`.

Published after Node 24.21.0, clean npm ci, TypeScript/lint, 1,010 tests and all-platform export
passed. EAS confirmed both platforms and the active channel mapping. Moves the interval bell to
Prepare, removes the intention and Brown Noise, and includes clean-up, Consistency rounds and
level-up moments. Native listening, gestures, completion animation and update arrival remain
device checks. A new iPhone installation needs the separately built IPA before it can receive OTA.

### 2026-10-17 — Journey opens on the calendar; Friends

- Update group: `0f13c9ed-0388-41b5-9201-fa3ca9bbef35` —
  [Expo dashboard](https://expo.dev/accounts/tripto92/projects/MeditationApp/updates/0f13c9ed-0388-41b5-9201-fa3ca9bbef35).
- Source commit: `28b1943bdd38ede6eeb13bdb156da0b0c6f95ed4` (clean main).
- Android and iOS, runtime `1.2.0`, channel/branch `preview`, EAS environment `preview`.

Published after Node 24.21.0, npm ci, refreshed Expo Router route types, TypeScript/lint,
1,033 passing tests and all-platform export. EAS confirmed the active preview channel maps to
this group for both platforms. The Friends migration was run successfully by the owner in the
Supabase SQL editor. Adding the friend's Google account as a test user is deferred by the owner;
that account cannot sign in until it is added or Google sign-in is published.

### 2026-10-17 — Rules V7, Consistency levels and colours, Consistency page, Ripples split

- Update group: `43897c80-f08f-4a13-9146-07184eb7e447` —
  [Expo dashboard](https://expo.dev/accounts/tripto92/projects/MeditationApp/updates/43897c80-f08f-4a13-9146-07184eb7e447).
- Source commit: `a5bb18219ff200409ecfeb87b25d6e6cb66b3695` (clean main).
- Android and iOS, runtime `1.2.0`, channel/branch `preview`, EAS environment `preview`.
- Android update: `01a14af5-b4f2-7106-be6a-fd15c6716ea5`.
- iOS update: `01a14af5-b4f2-77f7-b123-5548358fb06f`.

Published with the message above after Node 24.21.0, npm ci, offline Expo Router generation
confirming `/consistency`, TypeScript/lint, 1,042 passing tests (550 domain, 492 data) and
all-platform export. EAS confirmed both platforms, runtime, source commit and the active preview
channel's mapping to this group. Ships Rules V7, Consistency levels and colours, the Consistency
page and the practice/Consistency Ripples split. Update arrival and native behaviour remain device
checks; no APK or IPA was built. npm ci completed with audit warnings (11 moderate, 20 high);
dependencies were unchanged.
