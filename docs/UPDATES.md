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
npx eas-cli@latest update --channel preview --platform android --message "<what changed>"
```

The preview build profile uses channel `preview`. Builds made before 1.2.0 have no update support
and must be replaced once by the 1.2.0 APK. An update that misbehaves can be undone by republishing
the previous commit (`eas update:republish` or a new update from that commit).
