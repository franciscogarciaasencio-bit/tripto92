# Ona on iPhone without a paid Apple account

The owner chose not to pay for the Apple Developer Program yet (2026-10-15). Ona therefore reaches
the iPhone the free way: an **unsigned** app built on GitHub's Mac runners, signed on the owner's
Windows PC with a **free Apple ID** by AltStore (or Sideloadly), and renewed every 7 days.
Over-the-air updates work exactly as on Android once it is installed.

## What is configured

- app.json `ios`: bundle identifier `com.meditation.ona` (same as Android), build number 1,
  iPhone only, no export-encryption declaration needed. `updates.requestHeaders` names the
  `preview` channel, so builds made outside EAS (this one) listen to the same channel as the APK.
- expo-audio's `enableBackgroundPlayback` adds `UIBackgroundModes: audio`, so a practice keeps its
  sound with the screen locked. The app needs **no entitlements** (no push, no app groups, no
  iCloud), which is what a free Apple ID can sign.
- Google sign-in returns through `meditationapp://auth-callback`, the same redirect the APK uses
  (already allowed in Supabase). It opens Apple's secure sign-in sheet.
- .github/workflows/ios-unsigned.yml: on demand, a macOS runner runs `npm ci`, `npm run check`,
  `expo prebuild --platform ios`, CocoaPods and an unsigned Release `xcodebuild`, verifies the
  bundled JavaScript, bundle ID, version 1.2.0, background audio and the update runtime/channel,
  then uploads `Ona-1.2.0-unsigned.ipa` (kept 14 days). The ios folder exists only on the runner.

Private repositories get limited free macOS minutes each month (counted ×10); one build takes
roughly 20–40 runner minutes, so build only when the native app changes. If GitHub retires the
`macos-26` image name, use the newest macOS image that has the Xcode Expo SDK 57 requires.

## Installing (owner's PC, once)

1. Run the workflow and download the .ipa (Codex: `gh workflow run ios-unsigned.yml --ref main`,
   then `gh run download`). Never commit the .ipa.
2. Install AltServer for Windows from altstore.io, following its current instructions (it relies
   on Apple's iTunes and iCloud for Windows). Connect the iPhone by USB, trust the PC, install
   AltStore onto the iPhone with the owner's Apple ID.
3. On the iPhone: Settings → General → VPN & Device Management → trust the Apple ID; turn on
   Settings → Privacy & Security → Developer Mode (restart when asked).
4. AltServer → Sideload .ipa → choose the downloaded file (or open the .ipa in AltStore → My Apps).

The Apple ID password is typed into AltServer, a third-party tool; that is the owner's decision.

## Living with it

- **Every 7 days** the free Apple ID signature expires. AltStore can renew apps it manages in
  the background while the PC runs AltServer and the iPhone is on the same Wi-Fi; otherwise use
  AltStore → My Apps → Refresh All, or connect by USB. Ona was installed directly through AltServer
  on 2026-10-17, so its AltStore renewal is not yet confirmed: check whether Ona appears in My Apps.
  Until renewal is confirmed, re-sign the same IPA through AltServer before seven days elapse,
  installing over the existing app. An expired Ona will not open until renewed. **Never delete it**;
  keeping the existing app preserves its practice data.
- A free Apple ID allows 3 sideloaded apps at once (AltStore counts as one).
- Updates: publish with `--platform all` (docs/UPDATES.md). JavaScript and assets reach both
  phones; native changes need a new runtime version, a new APK **and** a new run of this workflow,
  then installing the new .ipa over the old one with AltStore (data kept).

## Verified unsigned build — 2026-10-16

[GitHub run 38858542679](https://github.com/franciscogarciaasencio-bit/tripto92/actions/runs/38858542679)
succeeded on its first attempt from commit `f82e964c57be691d2220746db4d023e6cc217c8f`.
Artifact `ona-ios-unsigned-f82e964c57be691d2220746db4d023e6cc217c8f` is retained until 2026-10-30.

- File: `Ona-1.2.0-unsigned.ipa`, **50.14 MB** (50,136,861 bytes, decimal MB).
- SHA-256: `8ef9ddea0ba50e24b2409c21ebdec139c2bde8703af4b1b8e00c5f87fa4243ba`.
- Downloaded with `gh run download` to the owner's Downloads/ona-ios/run-38858542679 folder,
  outside the repository. The downloaded file matches the runner's checksum.

The workflow and downloaded archive checks passed: ARM64 app, `com.meditation.ona`, version
1.2.0 (build 1), bundled Hermes JavaScript/update manifest, background audio, update runtime
1.2.0 and channel preview. Local TypeScript/lint, 998 tests and all-platform export also passed.
No build fixes or Apple credentials were needed; no generated ios folder or IPA was committed.

## Latest verified unsigned build — 2026-10-17

[GitHub run 39029728384](https://github.com/franciscogarciaasencio-bit/tripto92/actions/runs/39029728384)
succeeded on its first attempt from commit `f192e21c050bde986388485b8763a0b89ab87f2e`.
Artifact `ona-ios-unsigned-f192e21c050bde986388485b8763a0b89ab87f2e` is retained until 2026-10-31.

- File: `Ona-1.2.0-unsigned.ipa`, **36.49 MB** (36,490,447 bytes, decimal MB).
- SHA-256: `b6b05c5ef493214d67bf996fc24f413d5cf74670507292584d58ffdef6cc651e`.
- Downloaded with `gh run download` to Downloads/ona-ios/run-39029728384, outside the repository;
  a convenient latest copy is at Downloads/ona-ios/Ona-1.2.0-unsigned.ipa.

The runner's checksum matches the local file. Archive checks passed: ARM64 app,
`com.meditation.ona`, version 1.2.0 (build 1), bundled Hermes/update manifest, background audio,
runtime `1.2.0`, channel `preview` and the configured Expo update URL. Local npm ci,
TypeScript/lint, 1,010 tests and all-platform export passed before dispatch; the workflow's
checks also passed. The app required no build fix; no generated ios folder, IPA or Apple
credentials were committed.

The owner confirmed AltStore is installed and signed in. AltServer was confirmed running on the
PC. Copying into iCloud Drive is blocked by the owner's iCloud sign-in error; its sync folder is
absent, so no successful iCloud transfer is claimed. The downloaded IPA can instead be imported
into AltStore after transfer to Files, or installed from the PC with AltServer's
Shift-click → Sideload .ipa menu. See the installation result below.

## Installation confirmed — 2026-10-17

The owner downloaded the verified IPA over a temporary local Wi-Fi link after iCloud sign-in
failed. Importing it through the iPhone AltStore app failed with `Apple.APIError -90010` and
`AltStore.AppleDeveloperError 3000` (Apple authentication HTTP 503). Refresh All succeeded.
Disabling Prefer Remote AltServer and retrying over USB still returned HTTP 503.

Direct installation from the Windows AltServer 1.8 tray menu (Shift-click → Sideload .ipa →
iPhone → the same verified IPA) succeeded. The owner then confirmed Ona opens and works after
being asked to check Home and Settings version 1.2.0. No Ona archive or app-code change was needed.
The owner also reported successful sign-in to the already-installed iLoader 2.3.9.

Ona keeps its embedded preview runtime 1.2.0 update configuration. JavaScript/asset updates download
on launch and apply on the next launch; free-ID signature renewal is a separate weekly task.
Background renewal of this directly installed app and arrival of a later OTA still need confirmation.

## Device checks still pending

Focused checks remain for long locked-screen audio, Google sign-in in the standalone iPhone app,
safe areas/accessibility, weekly signature renewal and arrival of a later OTA update. The owner
has confirmed installation and normal opening; those focused checks were not individually reported.
