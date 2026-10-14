# Ona

An offline, account-free meditation app for iPhone and Android. Built with Expo SDK 57,
React Native, TypeScript, Expo Router and local SQLite. The app includes an open-ended
timer, session recovery, Ripples, 125 levels, Consistency, calendar/history, gentle wave
motion, a highest-achievement growing forest, acoustic meditation bells and optional ambient sound.

The active development program and next `continue` session are tracked in
[ONA_20_SESSION_PLAN.md](docs/ONA_20_SESSION_PLAN.md). Google/cloud integration and a
signed Android APK status is tracked there. [Android builds](docs/ANDROID_BUILD.md)
documents the application ID, signing, preview build and installation steps.
The first signed standalone [Android APK](https://expo.dev/artifacts/eas/p2jNw-l8qcUSo_NpuSiXdxU1P6CORWmXcT-vlKKqtZs.apk)
is available (1.0.0, approximately 205 MB). Device acceptance is still pending.

## Development

Use Node **24+**: tests use its built-in SQLite implementation. Install the locked dependencies:

~~~sh
npm ci
npm start -- --clear
~~~

For iPhone foreground testing, use an SDK-compatible Expo Go app on the same Wi-Fi
network and scan the terminal QR code with Camera. Expo Go cannot apply this project's
native background-audio configuration; use a rebuilt development/standalone binary
for locked-screen audio testing. No account/network connection is needed to use Ona.

## Quality checks

~~~sh
npm run check
npx expo export --platform all
~~~

The first command runs TypeScript, ESLint and all domain/data/audio/presentation tests.
Tests use Node's test runner and real SQLite; no UI-testing framework is installed.
Export checks JavaScript/assets for iOS, Android and web; it does not build signed native
binaries or prove physical-device behavior. Web SQLite requires COOP/COEP response
headers (configured for Metro in app.json); native is the primary target.

Useful focused commands: npm run test:domain, npm run test:data,
npm run test:coverage, node scripts/simulate-progression-v5.cjs (current),
node scripts/simulate-habit.cjs (historical V4).

## Code map

| Directory | Responsibility |
| --- | --- |
| src/app | Expo Router screens only |
| src/ui | Visual components, geometry and presentation animation |
| src/application | Owned storage/audio services and timer/save lifecycle |
| src/domain | Framework-independent meditation and progression rules |
| src/data | Repositories, validation, SQLite adapter and migrations |
| src/audio | Playback policies/controllers, native/web adapters and asset catalogue |
| assets | Runtime assets and essential editable/provenance sources |
| scripts, tests | Audio generation/analysis, simulations and automated checks |

Read [Architecture](docs/ARCHITECTURE.md), [Game system](docs/GAME_SYSTEM.md),
[UI](docs/ONA_UI.md) and [Audio](docs/AUDIO.md) before changing those areas.
