# Ona

An offline meditation app built with Expo SDK 57, React Native, TypeScript and Expo Router.
The native Ona flow uses the approved Manrope/light-sand visual design, a silent timer and local SQLite persistence.

## Test on an iPhone

```powershell
cd C:\Users\fga31\Documents\MeditationApp
npx expo start --clear --go --offline --port 8090
```

Use Expo Go on an iPhone on the same Wi-Fi network. Scan the terminal QR code with Camera.
`--offline` avoids CLI cloud requests while retaining the local connection. Stop a previous server if the port is occupied.
Use an Expo Go version compatible with the installed SDK. The added SVG and Crypto modules are included in Expo Go.

## Verify

```bash
npm test
npx tsc --noEmit
npm run lint
npx expo export --platform all
```

Node 24+ is required for the repository tests' built-in SQLite runner. No additional testing framework is installed.
An exported web app requires COOP/COEP response headers for SQLite; see the architecture notes for current web dev-mode limits.

## Code map

- `src/app/`: native screens and Expo Router stack.
- `src/ui/`: approved visual foundations and wave/motion components.
- `src/application/`: one owned store and the timer/save lifecycle.
- `src/domain/`: framework-independent timer and versioned progression logic.
- `src/data/`: migrations, repositories, validation and the only Expo SQLite adapter.
- [Game rules](docs/GAME_SYSTEM.md), [storage architecture](docs/ARCHITECTURE.md), [Ona UI and design provenance](docs/ONA_UI.md).

Meditate starts an open-ended practice immediately. Active time counts up, with Pause/Resume,
Finish, optional time hiding and deliberate discard. Saved summaries show actual XP, completed
history count and numbered level progress. One hundred levels subdivide the existing ten stages;
earning rules, centi-XP receipts and decay are unchanged. V3 preserves legacy timed history/drafts.

Ambient playback and gongs are not implemented in this milestone. Their preferences are editable
and retained; meditation is silent.
