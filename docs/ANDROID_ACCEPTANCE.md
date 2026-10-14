# Session 12 — Android acceptance

2026-10-14 (later): **owner device acceptance.** The owner installed the existing APK on
their own physical Android phone and reports it working; they now test there directly.
Individual table rows below were not separately reported and remain the checklist for
targeted follow-up. Legacy storage/overlay declarations are now blocked in app config
(effective from the next build). Earlier the same day, before the owner's phone was used:

2026-10-14: **partial; native runtime blocked**, not a completed device test.
No Android phone is available (confirmed by owner). The existing API 37 x86_64 AVD
cannot boot: `Android Emulator hypervisor driver is not installed on this machine`.
No system driver/virtualization changes were made. No APK installed or app executed.

## Verified here

- Reused the Session 11 signed APK; no rebuild or credential change.
- Signature, package/version, bundled Hermes, eleven exact offline sound hashes,
  background playback permissions and no microphone permission pass.
- 16 KB ZIP alignment passes. Added ELF program-header verification: every bundled
  ARM64/x86_64 library has power-of-two PT_LOAD alignment of at least 16 KB and
  congruent file/virtual offsets. This is static compatibility, not native execution.
- `npm run check`: 878 tests, TypeScript/lint pass. `python scripts/test-android-apk.py`:
  seven verifier fixture tests pass. All-platform exports passed in Session 11; this
  session changes only host verification scripts/documentation.
- Reviewed existing hardware Back guards, restoration routes, audio lifecycle and
  media-service ownership. No confirmed integration defect justified a runtime change.
- Legacy READ/WRITE_EXTERNAL_STORAGE (maxSdk32) and SYSTEM_ALERT_WINDOW are present
  in the built manifest. Review/remove unnecessary declarations through app config in
  a future verified build; do not interpret them as permissions granted at runtime.

Evidence: `.expo/program-session-12/` (emulator failure, check and APK logs) and
`artifacts/android/verification-session-12.json`. See ANDROID_BUILD.md for installation.

## Finish on an Android device or working emulator

Use the existing APK. With adb, select the intended test device explicitly if several
are connected. Install with `adb -s DEVICE install -r artifacts/android/ona-preview.apk`,
then launch `adb -s DEVICE shell am start -n com.meditation.ona/.MainActivity`.
Record device/model/API/page size (`adb shell getconf PAGE_SIZE`), build ID and results.
Do not clear/uninstall a user's app to prepare a test; destructive checks require a
dedicated test installation and explicitly disposable practice data.

| Check | Required observation |
| --- | --- |
| Cold launch offline | Opens Ona with correct artwork/fonts, no Metro/network required, no splash hang/crash |
| Navigation | Home/Journey/Guide/Settings/Forest; hardware Back including Forest, session and completion; safe areas/large text |
| Wave | Native SVG visibly undulates, shared phase across session/completion, background cancels work; check Reduce Motion |
| Session | Start, pause, wait, resume, finish; only active time counted; one immutable save/reward/calendar/history entry |
| Recovery | Close/reopen while running/paused and during saved completion; correct restored state, no replayed start or duplicate reward |
| Persistence | Preferences and history survive relaunch; repeated reopening does not double-apply decay |
| Audio | Every preview/ambience, Silence, mute/volumes; quiet bells, full End tail through Continue; no overlapping abandoned players |
| Background | More than five active minutes locked; interval excludes paused time; Home audio stops in background |
| Interruptions | Competing audio/call/headphones/OS media controls; safe interruption/resume; no catch-up burst |
| Reset (test data only) | Confirm Reset All Practice Data; preferences retained, empty history/calendar/Level 0 after relaunch |
| Compatibility | Physical ARM64 and older supported Android when available; 16 KB runtime separately from static alignment |

Save native screenshots/logcat and measured observations, not just pass assertions.
Physical audio comfort and performance still require listening/device feedback even
after emulator acceptance. Do not begin Session 13 automatically: owner is handing
development to Claude. Operational context is in CLAUDE_HANDOFF.md.
