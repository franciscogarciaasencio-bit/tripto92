# Android preview builds

Ona's permanent application ID is **com.meditation.ona**, chosen by the user.
The EAS project is @tripto92/MeditationApp (ID 3ec57447-1b2b-428b-a9cf-dd0216e351b5).
app.json owns identity/version; app.config.ts preserves these while applying theme tokens.
eas.json's preview profile produces an internally distributed, signed **release APK**,
with Node 24.21.0. It is standalone: no Expo Go, development client or Metro is needed.

## Size settings (from 1.1.0, versionCode 2)

app.json applies expo-build-properties: `buildArchs: ["armeabi-v7a", "arm64-v8a"]` (every Android
phone; x86/x86_64 only served emulators) and `useLegacyPackaging: true` (native libraries compressed
inside the APK). Runtime artwork is WebP and the Choir AAC (docs/ONA_UI.md, "App size and icon").
Together these reduce the APK from the first build's 205.29 MB to 94.44 MB in the verified build below.
An x86_64 emulator can no longer install this APK; add "x86_64" to buildArchs for emulator testing.
The launcher icon is Ona's own (assets/images, scripts/icon/build-icons.cjs), not the Expo template.

### Verified preview 1.2.0 (3) — 2026-10-15

- Build ID: `9965c099-b649-43b8-8946-0cac1449d6bc`;
  [build page](https://expo.dev/accounts/tripto92/projects/MeditationApp/builds/9965c099-b649-43b8-8946-0cac1449d6bc).
- [Download APK](https://expo.dev/artifacts/eas/OvcG8iz0OPjWalgbSYSoCiURGmfz2h5CbtOVW3bVyiY.apk):
  **94.44 MB** (94,441,581 bytes; decimal MB, compared with the first APK's 205.29 MB).
- APK SHA-256: `207b959959cd542d9023c456edfb856dcdc76c2e018d63ba48da1e7c0ec23a36`.
- Signing certificate SHA-256: `15fccec1f10e5788cbfc12612184df2bc997872d761715c25031c4e2bd48bce7`.

Built from `e5b97563f965c087a121e51373586da701fb809f`, using the existing EAS-managed key.
The verifier passed: release identity, signature, bundled Hermes/offline audio, ZIP and ARM64
16 KB ELF alignment. Additional artifact checks confirmed exactly 26 compressed native libraries
per ARM ABI, current runtime artwork/audio hashes, and enabled EAS Update with runtime `1.2.0`,
channel `preview`, check on launch and zero launch wait. TypeScript, lint, 996 tests, seven APK
verifier fixtures and the all-platform export passed. No verifier changes were needed.
Ignored local files: artifacts/android/ona-preview-1.2.0-3.apk and verification-1.2.0-3.json.
Install over the existing Ona app **without uninstalling** to retain practice data. Installation
and subsequent OTA arrival still need the owner's confirmation; see docs/UPDATES.md.

The cloud workspace cannot reach Expo's build service, so the owner starts builds from the Windows PC
(through Codex): pull main, `npm ci`, `npm run check`, then the EAS command below. EAS keeps the same
signing key, so the new APK installs over the old one and keeps the phone's practice.

### Verified preview 1.2.0 (4) — 2026-10-17

- Build ID: `a8ce54e7-91d5-4c0d-82f2-35ac8a83694a`;
  [build page](https://expo.dev/accounts/tripto92/projects/MeditationApp/builds/a8ce54e7-91d5-4c0d-82f2-35ac8a83694a).
- [Download APK](https://expo.dev/artifacts/eas/2OFoIjHoKFIMm4UrOCXgkBo0XEaHYK7TMi5wxr4Z7zI.apk):
  **68.45 MB** (68,447,760 bytes; decimal MB, down from 94.44 MB and the first APK's 205.29 MB).
- APK SHA-256: `9f96eb985f3b2258646e6d981a06167e5118e52b192cbed68878a87766ce3e53`.
- Signing certificate SHA-256: `15fccec1f10e5788cbfc12612184df2bc997872d761715c25031c4e2bd48bce7`.

Built from clean commit `f192e21c050bde986388485b8763a0b89ab87f2e` using the existing EAS-managed
keystore. Verified package `com.meditation.ona`, version `1.2.0` / versionCode `4`, release Hermes,
all 26 current offline audio files, compressed libraries (26 each for armeabi-v7a and arm64-v8a),
ZIP alignment and ARM64 16 KB ELF alignment. Embedded EAS Update is enabled for runtime `1.2.0`,
channel `preview`, check on launch and zero launch wait. Node 24.21.0, npm ci, TypeScript/lint,
1,010 tests, all-platform export and eight APK-verifier fixtures passed. The verifier now uses the
current interval-loop manifest and also checks the ending timeline; its regression test checks
coverage against the runtime audio catalogue.

Owner's copy: `C:\Users\fga31\Downloads\Ona-1.2.0-4.apk`. Ignored verification copy/report:
artifacts/android/ona-preview-1.2.0-4.apk and verification-1.2.0-4.json. Install over the existing
Ona app **without uninstalling** to retain practice data. Device installation/listening remain
owner checks.

### Verified preview 1.2.0 (5) — 2026-10-17

- Build ID: `d13034fa-6dba-4e73-abe9-e495bdac5e6c`;
  [build page](https://expo.dev/accounts/tripto92/projects/MeditationApp/builds/d13034fa-6dba-4e73-abe9-e495bdac5e6c).
- [Download APK](https://expo.dev/artifacts/eas/NeWIxSSkrTD5ESKWcm5Gl_iKYzgdab9YAYWcXbuQueI.apk):
  **68.48 MB** (68,482,972 bytes; decimal MB).
- APK SHA-256: `dec0c1ffdf5efc676a4b1e290912a4dbd9916af89bac7474c213ebefae817308`.
- Signing certificate SHA-256: `15fccec1f10e5788cbfc12612184df2bc997872d761715c25031c4e2bd48bce7`.

Built from clean commit `28b1943bdd38ede6eeb13bdb156da0b0c6f95ed4` with the existing EAS-managed
keystore. Verified package `com.meditation.ona`, version `1.2.0` / versionCode `5`, release Hermes,
current runtime audio, ZIP alignment and ARM64 16 KB ELF alignment. Contains exactly 26 compressed
native libraries each for `armeabi-v7a` and `arm64-v8a`; embedded EAS Update is enabled for runtime
`1.2.0`, channel `preview`, check on launch and zero launch wait. Node 24.21.0, npm ci, TypeScript/lint,
1,033 tests and all-platform export passed. The Friends migration was applied successfully to the live
Supabase project by the owner. Google test-user access is pending the owner's later setup.

Owner's copy: `C:\Users\fga31\Downloads\Ona-1.2.0-5.apk`. Ignored verification copy/report:
artifacts/android/ona-preview-1.2.0-5.apk and verification-1.2.0-5.json. Install over the existing
Ona app **without uninstalling** to retain practice data. Device installation/listening remain
owner checks.

## Build and installation

First verified release preview (Session 11): **1.0.0 (1)**, 205.29 MB, Android 7+
(minSdk 24), target SDK 36. [Download APK](https://expo.dev/artifacts/eas/p2jNw-l8qcUSo_NpuSiXdxU1P6CORWmXcT-vlKKqtZs.apk)
or view [build 37530f47](https://expo.dev/accounts/tripto92/projects/MeditationApp/builds/37530f47-9acd-4eff-b7a3-dffcb8452730).
Local copy/report: artifacts/android/ona-preview.apk and verification.json.
APK SHA-256: 9386728b724ae5be9b46571376f141accc6ac35d95d8844a3a7dfa33b06ae2a0.
Signing certificate SHA-256: 15fccec1f10e5788cbfc12612184df2bc997872d761715c25031c4e2bd48bce7.
The universal APK includes several CPU architectures and full-quality offline artwork/audio.

```sh
npm ci
npm run check
npx eas-cli@latest whoami
npx eas-cli@latest build --platform android --profile preview
```

Use the existing Expo account/project. The user explicitly approved source/asset upload
to EAS and generation/storage of its Android signing keystore. EAS manages that key;
no private signing material belongs in Git, app configuration or documentation.
Preserve the key and application ID for update compatibility. Future preview releases
should increment android.versionCode and retain the same signing credential.

.easignore excludes local evidence/databases, generated native folders, signing files,
original acoustic source masters and previous APK artifacts. The bundled runtime assets
remain included. Native projects are generated by Expo CNG on EAS; do not hand-edit them.
The repository lockfile is the dependency source; a dirty tree's actual working files
are uploaded, so the old Git HEAD alone does not identify a preview's complete source.

Download the APK from the build page on an Android device, permit installation from
that browser if prompted, then open Ona. Alternatively, with Android SDK platform-tools:

```sh
adb devices
adb install -r /path/to/ona-preview.apk
adb shell am start -n com.meditation.ona/.MainActivity
```

- APKs install on Android; they cannot be installed on an iPhone.
- This is a test distribution, not a Play Store submission or public release.
- The standalone app has its own local database. Expo Go's existing practice data does
  not automatically transfer into this new app sandbox. No data was reset by building.
- Installing a later APK with the same ID/key using -r retains its local app data.
  Do not uninstall to update unless intentionally removing that data.
- The native audio configuration enables background playback without recording permissions.
  Verify real OS audio behavior; config/export alone is not proof of locked-screen playback.

## Artifact verification

Record the EAS build ID, APK SHA-256, version, package, SDK requirements and public signing
certificate digest alongside a downloaded artifact. Android build-tools can verify it:

```sh
apksigner verify --verbose --print-certs /path/to/ona-preview.apk
aapt2 dump badging /path/to/ona-preview.apk
zipalign -c -P 16 -v 4 /path/to/ona-preview.apk
```

For one combined report, run the repository helper with your installed Java and Android
build-tools paths (Python standard library only):

```sh
python scripts/verify-android-apk.py artifacts/android/ona-preview.apk --java /path/to/java --build-tools /path/to/sdk/build-tools/36.0.0 --report artifacts/android/verification.json
```

It compares all 26 runtime audio files against the current source manifests/Choir,
checks the release identity, bundled Hermes and arm64 libraries, signing/ZIP alignment,
background playback permissions and absence of microphone recording. Its public certificate
digest is safe to retain; it never exports or reads the private signing keystore.
Android's output may label the minimum as minSdkVersion or sdkVersion; both are supported.

Artifacts are stored under ignored artifacts/android/. Never treat a JavaScript export
as an APK. Check for a bundled Hermes payload and current local sounds/images; exclude
the retired procedural bells. Installation/startup, hardware Back, safe areas, animation,
session recovery, audio focus and long locked-screen practice require a device/emulator.
Session 12 covers that acceptance; signing and ZIP checks do not establish native runtime.
ZIP page alignment also does not verify ELF load-segment alignment. The first APK retains
Expo's default legacy storage/overlay permission declarations; review necessity in Session 12
before public distribution. No microphone/recording permission is present.

Session 12 extended the verifier to check every bundled 64-bit ELF PT_LOAD segment;
all ARM64/x86_64 libraries pass the 16 KB alignment/congruence gate. Run
`python scripts/test-android-apk.py` for eight standard-library fixtures (ELF alignment and runtime
audio catalogue coverage). This still
does not prove device execution. Native acceptance is pending because no phone is
available and the existing emulator lacks its hypervisor driver. See ANDROID_ACCEPTANCE.md
for the remaining checklist and CLAUDE_HANDOFF.md for external setup/signing context.

## Native splash configuration

Expo 57's Android splash styles require splashscreen_logo even when image is omitted.
The first build exposed this resource-linking failure. app.json supplies a transparent
one-pixel Android-only PNG, preserving the existing warm blank native launch canvas.
app.config.ts preserves plugin options while applying the shared theme. Do not discard
the image/Android options when updating theme configuration. Tests cover that contract;
Expo CNG creates density drawables, without manually editing generated native resources.

## Local build alternative

This Windows computer has Android Studio/JDK 25, build-tools 36.0.0 and platform-tools.
Its initial SDK inventory only had android-37.0, while Expo 57 targets/compiles API 36.
No local SDK/JDK upgrade was performed for the hosted build. EAS --local is not officially
supported on Windows. A future local route uses Expo prebuild plus compatible Gradle/SDK
tools and proper signing through configuration/plugins, rather than modifying CNG output.

References: [Expo APK builds](https://docs.expo.dev/build-reference/apk/),
[CNG](https://docs.expo.dev/workflow/continuous-native-generation/),
[local build limits](https://docs.expo.dev/build-reference/local-builds/).

## Over-the-air updates

From 1.2.0 (versionCode 3) builds receive JavaScript/asset updates through EAS Update (channel
`preview`), so most changes no longer need a new APK. See docs/UPDATES.md for what qualifies and how to
publish. Native changes still need a new APK with a raised `expo.version`.
