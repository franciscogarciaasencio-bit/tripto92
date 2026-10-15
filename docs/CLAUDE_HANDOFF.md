# Claude handoff — external setup and chat decisions

Prepared 2026-10-14. This captures operational context from the Codex chat, not an
application architecture tutorial. Read AGENTS.md and the existing technical docs for code.

## Start here

> **Superseded 2026-10-14:** the working tree was committed as `e5c3b17` and pushed to
> GitHub (`franciscogarciaasencio-bit/tripto92`). Git now contains the current app; the
> notes below about uncommitted work and HEAD `9e910bf` are historical. The owner has a
> physical Android phone and authorized Sessions 13–20 (see ONA_20_SESSION_PLAN.md).

- Work in `C:\Users\fga31\Documents\MeditationApp`. Preserve its entire working tree.
  It contains many authorized, uncommitted milestones and untracked runtime files.
  Git HEAD `9e910bf` is only the older Choir replacement, **not the current app**.
  A clone/check-out of HEAD will lose most current functionality. Transfer/back up the
  actual working files and needed ignored source/evidence/artifacts before changing machines.
  Do not reset, clean, bulk-stage, or delete apparently unused source assets.
- The user is handing the project to Claude after Session 12. **Stop the autonomous
  program here.** Do not automatically begin Sessions 13–20 (accounts/cloud sync).
- Session 11 built the genuine signed APK. Session 12's artifact/source checks pass,
  but native acceptance is pending: no Android phone is available, and the installed
  emulator fails to boot because the Android Emulator hypervisor driver is missing.
  No app installation or native execution occurred. See ANDROID_ACCEPTANCE.md.
- The user primarily evaluates the app on a physical iPhone through Expo Go. Android
  APKs cannot install there. No signed iOS distribution was created.

## Expo identity and signing — preserve these

| Item | Value |
| --- | --- |
| Existing personal Expo account | `tripto92` |
| Project | `@tripto92/MeditationApp` |
| EAS project UUID | `3ec57447-1b2b-428b-a9cf-dd0216e351b5` |
| Permanent Android application ID, chosen by user | `com.meditation.ona` |
| Current version / Android versionCode | `1.1.0` / `2` in app.json (next APK); the installed APK is `1.0.0` / `1` |
| Build profile | `preview`, internal distribution, release APK, Node `24.21.0` |
| Current URL scheme | `meditationapp` (not configured as OAuth) |

**Credential created:** one Android RSA-2048 signing keystore, generated and held
remotely by Expo EAS for this project/package. The successful retry reused it.
No Expo account/password was created. No private keystore/password/alias was downloaded
or recorded in this chat or repository; those are managed by the existing account's EAS
credentials. The public certificate fingerprints below are identifiers, not secrets.

- Certificate SHA-1: `cda033fa49bd6afbfb0e632ee3d9398c4101571e`
- Certificate SHA-256: `15fccec1f10e5788cbfc12612184df2bc997872d761715c25031c4e2bd48bce7`

From this repository:

```sh
npx eas-cli@latest whoami
npx eas-cli@latest credentials --platform android
```

Use the existing account and preview credentials. EAS offers a credentials.json
download flow for a private backup if the owner needs one. Store that backup securely,
outside version control/chat/shared handoff docs. Do not regenerate/delete the key;
updates must retain the same package/signature. Increment versionCode for future builds.
Official recovery/management reference: https://docs.expo.dev/app-signing/app-credentials/.
Do not copy npm/Expo auth tokens from machine caches into a prompt or repository.

Explicit user approvals in this chat: use `com.meditation.ona`; upload source/bundled
runtime assets to EAS under `tripto92`; let Expo generate and store the Android key.
No purchase, paid subscription, Play Store submission or new account was made.

## Existing APK — reuse before rebuilding

- Successful build: `37530f47-9acd-4eff-b7a3-dffcb8452730`
- Build page: https://expo.dev/accounts/tripto92/projects/MeditationApp/builds/37530f47-9acd-4eff-b7a3-dffcb8452730
- Stable download: https://expo.dev/artifacts/eas/p2jNw-l8qcUSo_NpuSiXdxU1P6CORWmXcT-vlKKqtZs.apk
- Local APK: `artifacts/android/ona-preview.apk`, 205,288,874 bytes.
- APK SHA-256: `9386728b724ae5be9b46571376f141accc6ac35d95d8844a3a7dfa33b06ae2a0`
- EAS source fingerprint: `72eafe8605d004ec797694f1ad80496057f8366a`
- Release/non-debuggable, bundled Hermes, minSdk 24, target SDK 36; no Metro required.
- Failed first build `f3b6fe07-c3fe-4f88-aed3-74dd43c8e3d3` had a missing
  splashscreen_logo drawable. Fixed via transparent Android splash source and preserving
  plugin options in app.config.ts. Do not restore the old splash configuration.
- The long AWS signed URL shown in the browser expires; use the stable link/build page.
- `.easignore` excludes private/local evidence, source masters, native generated output
  and APKs. Uploads include actual dirty working files, not just HEAD.
- Standalone storage is separate from Expo Go. Updating with the same ID/key using
  `adb install -r` preserves standalone data; uninstalling removes it. No data import was built.

## External services not configured

No Google OAuth client/secret, Supabase/Firebase project, backend, service-role key,
cloud database, EAS Update release/channel, Play service account or store submission was
created in this program. No iOS bundleIdentifier, Apple signing certificate/provisioning
profile or TestFlight build was configured. Do not invent missing credentials.
Future Google/Play signing fingerprints may differ from this preview certificate.

## Machine-only tools and evidence

- Node 24.21.0/npm; Expo SDK 57.0.26, no Bun lockfile. EAS CLI ran through npx,
  not a new application dependency. No dependency or SDK upgrade in Sessions 11–12.
- Java: `C:\Program Files\Android\Android Studio\jbr\bin\java.exe` (JDK 25).
- Android SDK: `C:\Users\fga31\AppData\Local\Android\Sdk`; build-tools 36.0.0,
  platform-tools/adb, emulator and API 37 x86_64 image installed. Not necessarily on PATH.
- Existing AVD: `Medium_Phone_API_37.0`. Boot fails for missing hypervisor driver;
  no Windows driver installation, virtualization change or reboot performed.
- Python used: `C:\Users\fga31\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`.
  APK verification needs only its standard library plus Android build-tools/Java.
- Ignored evidence: `.expo/program-session-9` through `program-session-12`;
  artifact reports `artifacts/android/verification*.json` and manifest text.
  Exported bundles and generated Android verification output are in session 11 evidence.
  These are local-only; not automatically included in Git/EAS. Build evidence can contain
  expiring signed URLs; do not publish raw build diagnostics without review.
- Session 12 checks: 878 app tests (511 domain + 367 data), typecheck/lint; seven
  separate Python ELF verifier tests; actual APK signature/assets/ZIP/ELF checks pass.
  Session 11 iOS/Android/web exports passed; no runtime source changed in Session 12.

## User decisions and acceptance gaps worth carrying forward

- Forest should resemble the supplied closer `Forest entry.png`, rather than only
  zooming the Home coastline. Generated younger/mature scenes and source provenance
  already exist. Originals came from `C:\Users\fga31\OneDrive\Desktop\Ona\Forest 2`.
- The user explicitly requested that ambient wave movement remain with Reduce Motion
  enabled (reduced amplitude); other transitions respect that setting. The current
  program supersedes earlier timing requests with a 12-second wave cycle. Do not revert
  it to 10/18 seconds based on older chat snippets.
- The user requested all playback volume reduced 50%; the existing shared master gain
  implements that once. Do not halve stored settings again on handoff.
- User supplied Meditation Choir with CC0 declaration. Current bells were replaced with
  authentic CC0 acoustic recordings; source originals and provenance live in
  `scripts/audio-sources/bells`. Keep source/mastering scripts. No ongoing fees or mandatory
  attribution. Subjective headphone/speaker listening has **not** been established here.
- Browser UI playback, exports, signal analysis and controller tests do not prove
  physical native gapless loops, audio focus, locked-screen intervals or wave frame pacing.
- Existing Expo web development server hit an expo-sqlite worker serialization error;
  exported web with COOP/COEP was successfully tested. No SDK workaround was applied.
- Retained APK legacy storage/overlay declarations need review before public release.
  No microphone permission. ZIP and 64-bit ELF 16 KB alignment pass, but runtime on a
  16 KB Android device still needs acceptance.

Primary next action: finish native acceptance using the **existing APK**, following
ANDROID_ACCEPTANCE.md; then ask the owner what Claude should implement next.
