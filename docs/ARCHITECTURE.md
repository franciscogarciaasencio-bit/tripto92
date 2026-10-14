# Application architecture

## Layers

| Location | Responsibility |
| --- | --- |
| src/app | Expo Router routes; no SQL or reward calculations |
| src/ui | Components, visual tokens, pure geometry and cosmetic reward plans |
| src/application/ona-provider.tsx | One owned store, startup, timer actions, operation lock, save/retry handshake |
| src/application/audio-provider.tsx, src/audio | Owned ambience/session players and pure playback policy; see AUDIO.md |
| src/domain | Plain TypeScript meditation/progression; forbidden from importing persistence, UI or device APIs |
| src/data/index.ts, repositories | Small application-facing storage API |
| src/data/database/database.ts | Only native Expo SQLite adapter; raw connection never reaches screens |
| src/cloud | Optional: public Supabase config, Google sign-in (PKCE, secure-store tokens), RPC client; null when unconfigured |

The provider opens the ledger file of the active account (`databaseNameFor`): guest uses
`meditation.db`, each signed-in account its own file, bound to that account by migration 11.
Switching account happens only between practices and keeps screens mounted.

Read [Game system](GAME_SYSTEM.md) for rules, [UI](ONA_UI.md) for presentation.

The forest selector in src/domain/forest/growth.ts derives from the validated habit
checkpoint's highestLevel; it adds no authoritative stored value or earning rule.
UI asset definitions/geometry are separate. Explicit practice reset clears the existing
achievement and therefore vegetation; inactivity decay does not remove growth.

## Public storage API and startup

initializeDatabase(asOf) opens a private SQLite connection, configures foreign keys,
busy timeout, WAL/FULL synchronization and applies migrations transactionally. It
restores/validates history and continuation, recovers pending finished timers **before**
advancing time, settles complete days, activates the released V5 rules prospectively,
and supplies initialSnapshot, initialJourney, initialHabit, initialTimer and initialCompletion.

Own one MeditationStore for the application lifecycle; close waits for queued operations.

| Repository operation | Contract |
| --- | --- |
| meditations.completePractice(session, createdAt) | Atomic session/rewards/checkpoints/summary; returns presentation result |
| meditations.recordCompletedMeditation(session, createdAt) | Same durable completion path; compatibility snapshot result |
| meditations.getMeditationHistory({ limit, offset }) | Descending endedAt, insertion sequence breaks ties; max 1,000 per page |
| meditations.getPracticeDetails(id) | Read-only captured session and original centi-Ripple award; null if missing/deleted |
| meditations.loadProgressionState() | Reads current continuation without advancing time |
| meditations.getCurrentPracticeProgress(asOf) | Advances/persists only unsettled decay, returns snapshot + current journey + habit |
| meditations.getPendingCompletion(), acknowledgeCompletion(id, at) | Recover and acknowledge saved presentation, never re-award |
| meditations.resetAllPracticeData(asOf) | Confirmed permanent deletion; retains preferences |
| settings.load/savePreferences(), load/saveAudioPreferences() | Strict typed preference documents |
| timer repository | Durable running/paused/finished cursor; no UI-owned alternative timer state |

All clock context is explicit: safe-integer UTC milliseconds, captured localDate/IANA
timeZone; completed durations are integer seconds and XP remains integer centi-XP.
Application creates stable UUIDs. Original createdAt wins on identical retry.
Submit pending finished sessions before advancing beyond their completion timestamp.
Backdated/overlapping sessions and clock rollback fail explicitly. Refresh history
pagination if a new record appears between pages; calendar loads every page.
Practice-detail reads decode the session and immutable award under their registered
versions. They never advance progression, acknowledge a completion or reconstruct a
reward with current rules. Legacy sessions work without a presentation receipt.

## Atomicity and source of truth

Every operation, including reads and close, joins a serialized private queue.
BEGIN IMMEDIATE acquires SQLite's writer lock **before** loading continuation. Completion
appends the session, incremental awards, rule snapshots, immutable completion/journey/habit
receipts; updates continuation/achievements; deletes the corresponding timer; then commits.
Failure rolls back everything. Failed rollback poisons the connection until reopened.
Separate connections reload continuation under the same writer lock. Primary/unique keys,
foreign keys and immutable UPDATE/DELETE triggers supplement application validation.
Identical stable-ID retries are no-ops; conflicting payloads fail, even after later decay.
No public raw-award import or generic state-save operation exists.

Sessions, rule snapshots and award receipts are authoritative history. Lifetime totals
derive from receipts in the active generation; meditation time derives from sessions.
Progression/habit checkpoints are **authoritative continuation, not disposable caches**:
receipts alone cannot recover historical settlement/version-switch timing or peaks.
Completion animation plans are immutable presentation metadata, never another balance.
No launch recalculates old rewards with current formulas. Unsupported versions, missing
initialized checkpoints or inconsistent ledgers fail with PersistenceError; they never
trigger automatic deletion, fabricated balances or silent repair. A new database alone
receives empty state/defaults. Explicit backup/corruption-recovery tooling is not built.

V5 has one Consistency score for the bonus and five-dot bar. Immutable activation rows
identify source/target versions, logical asOf, history prefix and carried momentum.
They are authoritative version boundaries; checkpoints track their count, not a second
copy of the score. Loads validate prefix/order and exact settled source momentum.
appendTransition appends them with rules/checkpoint in the same transaction. Missing or
corrupt anchors fail explicitly. Original V1–V4 awards and their receipt endpoints survive.
loadCompletion uses the captured qualification algorithm and immutable habit receipt for
linear endpoints, even without an award (zero-active save); old fourteen-day endpoints
remain a historical read-only projection. No historical XP is rewritten.

## Schema and migrations

V1 SQL: database/schema.ts. Ordered released migrations **1–12**: database/migrations.ts.
schema_migrations tracks names/versions; startup validates the exact prefix. Migrations,
markers and restored initial continuation share one transaction. Reopening current data
is nondestructive. To extend, append migration **13**, add typed decoders/tests and document
its meaning; never edit released definitions or reset a DB to make a migration pass.

| Tables | Purpose |
| --- | --- |
| meditation_sessions | Immutable captured history, qualification/version, createdAt, ordering |
| progression_awards, progression_rules | Immutable incremental earning receipts and frozen configuration |
| progression_consistency_activations | Immutable per-generation formula activation/context/prefix; settled momentum carry |
| progression_checkpoint | Active generation's continuation, settlement cursor, occasions and ledger counts |
| habit_checkpoints, habit_reward_receipts | Effective Ripples, highest level, decay cursor, migration seed; base/Consistency/bonus plans |
| practice_completions | Immutable saved result and mutable first acknowledgement |
| journey_checkpoint, journey_completions, journey_animation_receipts | Released lifetime projection/peak and captured older display receipts |
| progression_generations | Old archival-reset boundaries and closed continuation |
| legacy_journey_checkpoint, journey_legacy_peaks | Historical migration achievement provenance |
| meditation_timer | One durable running/paused/pending cursor |
| meditation_preferences, audio_preferences, application_preferences | Typed settings and independent onboarding preference |
| schema_migrations | Applied ordered schema versions |
| sync_state, sync_manifest, sync_document_clocks | Migrations 11–12: device ID, bound account, synced revision, the synced base rows (content + hash), in-flight push, preference edit/acknowledgement clocks |
| sync_set_aside_sessions | Migration 11: practices that could not merge into the ledger (synced, immutable, cleared by reset) |

Decoders/validation/integrity validate untrusted rows, IDs, dates/zones, finite safe
integer times/XP, durations, known versions, ledger/occasion membership and receipt chains.
Legacy records remain decoded under their captured versions. V9 upgrades audio preference
JSON to version 2 while preserving old mute/source/volume/bell choices.

## Timer, recovery and full reset

The domain timer counts active milliseconds from a durable phase/changedAt cursor;
pause time is separate. Current UI is open-ended; earlier timed cursors remain supported.
The provider schedules one cancellable deadline for a running legacy timed cursor;
idle, open-ended and paused practice schedule no expiry polling. Foreground/unlock
rechecks the durable cursor, with overdue recovery retaining its captured zone. Foreground
progress refresh waits for active operations and pending practice/summary resolution.
Running recovery includes elapsed wall-clock time while closed; paused recovery excludes it.
Finished pending cursors save before current-time advancement; stable ID handles a crash
or lost COMMIT acknowledgement. The provider serializes actions and can reopen poisoned
storage; no uncertain transaction closure is blindly replayed against cached balances.

After explicit confirmation and without a pending timer/completion, Reset All Practice
Data deletes sessions, awards, archived generations, all peaks/receipts and timer/summary
state child-first in one transaction. It suspends/restores only fixed deletion guards
inside that transaction and creates empty Level 0 continuation. Settings, rules, schema
markers and onboarding remain. A deletion timestamp boundary rejects stale retries,
including sessions started exactly at that boundary. Application clears caches and
increments practiceRevision; history/calendar discard late responses. Reopening cannot
restore deleted data. resetProgression is an older archive-only API retained for data
compatibility/tests; it is not the Settings action.

## Verification and future boundaries

npm run check covers pure domain plus real Node SQLite repository/migration/reset tests,
fake-clock audio lifecycle and pure presentation plans. Node SQLite executes real SQL,
not the Expo native bridge. Native exports verify imports/assets, not device lifecycle.
Web SQLite additionally needs COOP/COEP headers; platform audio adapters share policies.
Optional account sync is specified in [Sync](SYNC.md). database/ledger.ts exports the
practice ledger as keyed, hashed rows and replaces it (`replaceLedger`) inside one
transaction followed by full startup validation; the sync repository tracks the bound
account, synced manifest and one durable in-flight push. Guest use needs none of it.
