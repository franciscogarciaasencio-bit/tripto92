# Working on Ona

This is a mobile-first Expo SDK 57 / React Native / TypeScript application.
Preserve current visuals, user data, historical awards and cross-platform behavior.

- Active 20-session program: read docs/ONA_20_SESSION_PLAN.md on `continue`; implement
  the requested number of substantial sessions, verify, update its log and stop.
  Default to one per continue; Sessions 2–5 were explicitly authorized as one completed batch.
  Preserve existing dirty work.

- Inspect Git status first; preserve unrelated changes. Trace imports, Router routes,
  configuration and dynamic assets before declaring a file unused.
- Read docs/ARCHITECTURE.md for repositories, migrations and recovery;
  docs/GAME_SYSTEM.md for current/legacy rule boundaries;
  docs/ONA_UI.md for design and motion; docs/AUDIO.md for sound ownership/provenance.
- src/app contains Expo Router routes only. Keep components/hooks outside it;
  use expo-router for navigation. Screens contain no SQL or earning formulas.
- src/domain is plain TypeScript: no React, React Native, Expo, SQLite or UI/data imports.
  Use src/domain/progression/index.ts; current displayed levels come from habit.ts,
  not legacy ranks/levels or the compatibility balance in ProgressSnapshot.
- Application code imports the storage API from src/data. Session completion is an
  atomic repository operation; animation/audio callbacks never award or save rewards.
- Preserve released rules V1–V5 and migrations 1–12. Add versioned rules or migration 13
  for future changes; never recompute historical earnings or auto-reset corrupt data.
- Optional account sync is designed in docs/SYNC.md. Ledger export/import (database/ledger.ts)
  is the only path that replaces practice wholesale, and it always revalidates like startup.
- AudioProvider owns playback. Reuse its controllers; do not create screen-owned
  players. Keep sound generators and asset provenance when retiring runtime assets.
- Before touching Expo/React Native APIs, inspect package.json and fetch the matching
  SDK docs at https://docs.expo.dev/versions/v57.0.0/ and https://docs.expo.dev/llms.txt.
  Use npx expo install for SDK-compatible additions; avoid unrelated upgrades.
- Do not manually create/edit ios or android folders. Use app config/plugins and a
  development build when native configuration changes; Expo Go cannot apply plugins.
- Read docs/ANDROID_BUILD.md for APK builds, signing and artifact verification. Preserve
  the approved application ID and signing key; never commit credentials or APK artifacts.
- Claude handoff: docs/CLAUDE_HANDOFF.md contains external setup/chat decisions. Session 12
  is complete (owner tests the APK on a physical Android phone). The owner authorized
  Sessions 13–20 plus the pre-meditation screen (before 19–20); see the plan's Resume here.
- The repository is on GitHub (origin/main). Pull before starting, commit and push after
  each session; only one agent (Codex or Claude) edits at a time.
- Node 24+ is required. Run npm run check before finishing; npm test covers domain,
  persistence, audio and reward/geometry logic. Export all platforms after changing
  imports, assets, dependencies or native config: npx expo export --platform all.
- Report physical-device limits honestly: web rendering/export is not native audio,
  locked-screen, accessibility or frame-pacing verification.
