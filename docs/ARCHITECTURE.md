# Application architecture

## Layers and entry points

- `src/app/`: Ona Expo Router screens, with a headerless stack and no tabs. Screens contain no SQL or XP calculations.
- `src/ui/`: approved design tokens, typography, outlined controls, wave geometry and launch motion.
- `src/application/ona-provider.tsx`: owns one database, startup, preferences, timer lifecycle and save/retry handshake.
- `src/domain/`: pure TypeScript progression. **Never import SQLite, React, React Native or Expo here.**
- `src/data/index.ts`: application-facing storage API. Future screens call repositories, never SQL.
- `src/data/database/database.ts`: the only Expo SQLite adapter. Opens a private native connection.
- `src/data/repositories/`: session/progression and typed settings operations.

Read [ONA_UI.md](ONA_UI.md) for design provenance, the implemented flow and device verification.

Read [GAME_SYSTEM.md](GAME_SYSTEM.md) for game rules and calendar semantics. Persistence does not change them.
The data validators reuse a few pure domain validation/consistency helpers; no earning formula is replayed on load.

## Public API and startup

```ts
import { initializeDatabase } from '@/data';

// The caller captures an explicit timestamp, localDate and IANA timeZone.
const store = await initializeDatabase(asOf);
const snapshot = store.initialSnapshot;
const preferences = await store.settings.loadPreferences();

await store.meditations.recordCompletedMeditation(session, createdAt);
const history = await store.meditations.getMeditationHistory({ limit: 50, offset: 0 });
const state = await store.meditations.loadProgressionState();
const laterSnapshot = await store.meditations.getCurrentProgressionSnapshot(laterAsOf);
await store.settings.savePreferences(updatedPreferences);
await store.close();
```

Own one store at application lifecycle level. Initialization configures SQLite, applies migrations,
restores and validates state, settles complete days to `asOf`, and commits the updated checkpoint.
`initialSnapshot` describes that completed startup; ask for a new snapshot when time advances.
`loadProgressionState` reads the persisted cursor without advancing it. Snapshot retrieval commits advancement.
Repeated opens/requests at the same context do not repeat decay. A returning meditation uses `recordSession`
and its normal earnings/decay rules.

All timestamps are UTC Unix **milliseconds** (safe integers), durations are whole **seconds**, and
all XP is integer **centi-XP**. Never persist display-rounded XP. History returns `{ session, createdAt }`
in descending completion order, with insertion sequence resolving ties; pagination is bounded to 1,000 rows.
Offset pagination should be refreshed if a new meditation is inserted between pages.

The caller supplies a stable globally unique session ID (use a UUID in the future timer) and a creation
timestamp at or after completion. The original creation timestamp wins on retry. IDs are opaque nonempty
strings; SQLite enforces uniqueness within the database. This layer neither creates IDs nor reads a clock.
Submit completed pending sessions **before** advancing beyond their completion timestamp. Backdated edits,
overlapping sessions and clock rollback fail explicitly, following the domain's chronological contract.

## Schema and source of truth

The V1 SQL lives in `src/data/database/schema.ts`.

| Table | Meaning / authority |
| --- | --- |
| `meditation_sessions` | Immutable session history, original qualification decision/version, creation timestamp and ordering. |
| `progression_awards` | Immutable incremental receipts, including zero-XP qualifying receipts, fixed-point XP and breakdown. One receipt per qualifying session. |
| `progression_rules` | Immutable, ordered snapshots of every rules configuration used. |
| `progression_checkpoint` | Singleton **authoritative continuation state**: current balance, as-of context, settlement cursor, highest achievement, active version, occasions and ledger counts. |
| `meditation_preferences` | Singleton typed preferences document. |
| `meditation_timer` | V2 singleton durable running/paused/pending-completion cursor; removed with the corresponding completion transaction. |
| `practice_completions` | V3 immutable before/after progression at the completion event, plus first Home acknowledgement. Presentation/recovery metadata, never an authoritative balance. |
| `journey_checkpoint` | V4 permanent highest legitimately unlocked lifetime level, display version and actual achievement timestamp. |
| `journey_completions` | V4 immutable credit delta, date credits and lifetime level transition for that completion. |
| `application_preferences` | V4 first explanation dismissal; independent of unchanged meditation preferences. |
| `schema_migrations` | Ordered schema versions and names already applied. |

Lifetime XP is reconstructed by summing stored receipts; total meditation time is reconstructed from
session activity. Current rank, consistency and other display fields are domain projections. These values
are not independently stored balances that can diverge. Occasions are validated against receipt chains
and session membership on load. Historical rule snapshots, qualification decisions, award timestamps,
breakdowns and session references remain intact.

**The checkpoint is not a disposable cache.** Receipts alone cannot recover past decay/version-switch
timing or a historical highest rank after arbitrary rule changes. If an initialized database has a missing
checkpoint, malformed data, inconsistent ledger or unsupported version, the operation fails with a
`PersistenceError`; it does not delete data, replay earnings, repair balances, or create a replacement
checkpoint. Only a genuinely new schema receives empty initial state and defaults. A future recovery tool
or backup policy must handle damaged databases explicitly. No event journal or automatic repair is included.

## Atomicity and concurrency

Each public operation uses a serialized queue on a private connection. `BEGIN IMMEDIATE` acquires the
SQLite write lock **before** loading the checkpoint. Session completion then calls the existing domain
engine and appends only new sessions/receipts/rules, updates the checkpoint, and commits as one transaction.
Any error rolls back the complete operation. A rollback failure makes the connection unusable until reopened.
Closing waits for queued operations. Separate connections must also acquire SQLite's writer lock and reload
the latest checkpoint; no cached balance is used. Lock timeouts surface errors for an explicit retry.

We use explicit transaction SQL because this connection is private and every query is queued; no ambient
Expo queries can join its transaction. Foreign keys are enabled on that same connection. WAL and FULL
synchronous mode are requested. Inputs are bound parameters, not interpolated SQL. Duplicate IDs with
identical session content are no-ops, including after later decay; conflicting content fails. Primary keys,
unique session-to-award links, foreign keys and append-only UPDATE/DELETE triggers add database protection.
There is no public raw-award import or generic state-save method.

## Rule versions and validation

`decoders.ts`, `validation.ts`, and `integrity.ts` form the untrusted-row boundary. They check required
types, finite safe integers, dates, timestamp ranges, duration bounds, session ordering, receipt relationships,
occasion totals, protected balance bounds, rank identity and checkpoint counts. Invalid/null data is rejected.
Time-zone identifiers are checked for syntax and retained verbatim; their membership in an IANA database
and timestamp/date correspondence belong to the capturing timer. The storage layer does not consult the
device's current zone or remap historical dates. This avoids differences between device tzdb versions.

The registry always retains V1/V2 and checks stored configuration against registered
definitions, ignoring JSON object key order. Adding a known future version to `supportedRules` does **not**
activate it. The native V4 release deliberately upgrades V1 to V2 after recovering pending completions
and settling old decay. It cannot downgrade a known future version. Use `store.meditations.changeRules(version, asOf)` for a deliberate transition: the domain
settles old decay, preserves old receipts and open-occasion terms, and then activates new rules atomically.
Retain V1 in future releases. Unknown versions fail explicitly, including when an older app opens newer data.
An actual new algorithm also requires a domain evaluator as described in GAME_SYSTEM.md.

Validation detects malformed and inconsistent data, not coordinated tampering with otherwise coherent
values. No cryptographic integrity seal or independent decay journal is claimed.

## Migrations and preferences

`migrations.ts` contains the ordered `MIGRATIONS` list. V2 adds the timer without modifying V1.
V3 adds completion metadata and assigns `mode='timed'` to V2 timer JSON; no historical
session/award/rule/checkpoint/preferences content is rewritten. New open cursors use
`mode='open_ended'` and a null target. V4 adds permanent journey/application metadata without rewriting V1–V3 records.
To add V5, append `{ version: 5, name, sql }`;
keep released migrations unchanged.
Initialization runs outstanding migrations and their markers transactionally,
together with checkpoint validation. An up-to-date database is not recreated. Unknown or mismatched migration
history fails closed. Future shape changes must migrate stored JSON as well as SQL columns; for changes that
cannot be expressed in SQLite SQL, extend a migration with a small typed transformation deliberately.
The tests demonstrate real V1/V2→V3 upgrades, a future sequential V5 addition and transactional DDL rollback. Destructive changes to protected
history require an explicit migration decision, never disabling triggers during ordinary writes.

Preferences use an extensible typed JSON object, not arbitrary keys. Defaults: 10 minutes, no ambience,
no periodic gong, ambience volume 0.3 and gong volume 0.5. Durations/intervals are positive integer seconds,
volumes are finite values in [0, 1], and sound IDs are opaque nonempty strings or null. Future preference
fields/default changes require a migration for existing rows; corrupt preferences never silently become defaults.

## Verification and limits

- `npm test`: original pure-domain suite plus repository/validation tests using Node 24+ built-in `node:sqlite`.
- `npm run test:coverage`: both suites with Node coverage. No extra test dependency.
- Tests compile data/domain code with strict TypeScript and no React/Expo ambient dependencies. The native
  adapter is checked by the project typecheck and explicit native bundle smoke checks.
- Real SQLite tests cover disk close/reopen, SQL constraints, rollback at several completion stages,
  migrations, version transitions, corruption, and decay. They use the same production SQL and repositories.
- These are **not native Expo runtime tests**. Verify force-close/relaunch, on-device filesystem behavior,
  busy/error handling, and background/resume on both iOS and Android before production release.
  Bundle/export success is not a signed native build or a device test.
- Web exports include Expo SQLite's WASM worker. `metro.config.js` adds the WASM asset extension;
  the Router plugin config declares COOP/COEP headers. A separately hosted export also needs those headers.
  The exported app is tested with real browser SQLite; web SQLite is upstream alpha. On this Windows SDK 57
  environment, dev-mode web bundling reports a missing worker chunk; production export works. No dependency patch is applied.

V1 restores complete history to match the existing domain state model. That favors inspectability over
large-history optimization; measure multi-year history on devices before introducing incremental hydration.
The API has stable IDs, timestamped records and a repository boundary where a future optional sync adapter
could sit. Sync/import conflict resolution and out-of-order historical imports are intentionally absent.

## Durable timer and completion recovery

`src/domain/meditation/timer.ts` is a pure timer cursor and explicit-zone calendar conversion, independent of React/Expo/SQLite.
The caller supplies IDs, timestamps and zone. Start/pause/resume retain integer milliseconds; completion floors active and
paused totals independently to whole seconds, matching the existing session contract. Paused time never earns XP.
Wall-clock time includes running time while backgrounded or terminated. An expired legacy timed timer finishes at its calculated deadline,
not the later reopening time. A paused timer remains paused indefinitely. Clock rollback fails explicitly; there is no guessed repair.

`store.timer.load()` / `.save(draft)` validate and serialize the one pending practice. Identity and target cannot change;
the zone can change only once when an observed completion captures its completion zone,
and a finished pending payload cannot be edited. The application serializes user operations, disables duplicate submissions,
and persists phase transitions before acknowledging them. A save failure retains the exact finished payload in memory for Retry;
the last successfully saved draft also remains in SQLite. If persisting the finish itself fails and the process dies, recovery uses
that last durable cursor; an unsaved early-end intent cannot be promised to survive.

During startup, `openStore` restores the draft **before** advancing progression. A finished/expired draft is converted to a session,
saved via the unchanged progression engine, its receipts appended, its checkpoint updated and its draft deleted in one transaction.
Then startup advances to the supplied current context. This prevents backdated-completion errors and duplicate decay/XP.
`initialTimer` and V3's `initialCompletion` restore the session/completion screen;
`recoveredSession` / `previousRank` remain available for compatibility.
Normal `recordCompletedMeditation` also deletes a matching draft within its existing atomic transaction; identical retries remain no-ops.
Application snapshot refreshes are suspended while a timer exists; callers must continue submitting pending completion before
advancing past its end. There are no new authoritative XP values or changes to award/version semantics.

The timer captures the device's IANA zone at **start** for recovery. Live/early completion captures the device's completion zone,
as GAME_SYSTEM.md requires. For an endpoint that occurred while backgrounded/terminated, the app cannot know its location:
recovery deliberately uses the saved practice zone rather than a possibly later travel zone. Completion date is computed at the
actual endpoint in that explicit zone. A successfully persisted finished payload always retains its original completion zone.
Stored historical sessions retain their original dates/zones. Intl conversion depends on the host tzdb;
the progression engine continues to consume explicit historical dates and performs no conversion.

## Open-ended completion and visible progression (V3)

The open-ended timer never expires. Finish emits `completed`, including short runs;
V1 eligibility remains five active minutes; the V4 app release activates prospective V2 three-minute eligibility. `timer.discard(id)` removes only an unfinished
matching cursor, idempotently, with no session/award. Old timed cursors/history retain
their original status/deadline semantics. Open running time includes locked/closed time;
paused time is excluded using explicit wall-clock cursors, not interval ticks.

`meditations.completePractice(session, createdAt)` returns `{ snapshot, completion }`.
Its transaction appends the session/immutable award, checkpoints progression, captures
before/after balances **after pre-earning decay**, inserts presentation metadata and
deletes the matching timer. Startup uses the same `persistCompletion` helper before
advancing to now. Stable IDs/exact duplicate content keep retries safe. Legacy
`recordCompletedMeditation` still returns a snapshot for existing callers.

`getCompletedPracticeCount()` queries saved sessions with `status='completed'`.
The summary's earlier count is also derived from session sequence/history. No counter
is independently incremented. Short completed sessions count; legacy early-ended
history retains its XP but is excluded from this completed count.

`getPendingCompletion()` restores an unacknowledged summary without earning again.
`acknowledgeCompletion(id, explicitTimestamp)` persists the first Home acknowledgement,
idempotently. Afterwards startup does not replay the summary. New stores expose
`initialCompletion` and `initialCompletedPractices` alongside the existing startup fields.
Pre-V3 records are not backfilled with guessed before/after balances or replayed summaries.

Completion metadata is validated against stored incremental award amounts. UPDATE/DELETE
triggers protect its balances; acknowledgement is the only mutable field. It is not used
for current XP, lifetime XP, decay or highest achievement. Missing old metadata is valid;
malformed existing metadata fails explicitly. Missing checkpoint policy remains unchanged.
One startup query validates metadata; only the pending summary needs derived count queries.

The old 100-level projection remains compatibility code only. Current lifetime progression is
`progression/journey.ts`, independent of the old decaying balance. See the V4 policy below.
Future sync remains above repositories.

Next: physical-device lifecycle/accessibility verification. Audio remains unimplemented.

## Permanent habit journey (V4)

Native startup registers historical earning configurations and deliberately activates progression_v2
only from V1. Existing finished cursors recover under their previously active rules **first**.
New completion uses three-minute eligibility. Old receipts, qualification flags, preferences, legacy
highest named rank, settlement cursor and V3 completion summaries remain intact. Unknown versions fail.

Saved validated sessions remain authoritative for practice credits and real dates; immutable receipts
remain authoritative for lifetime XP. Nothing infers dates from XP/count. No new duplicated XP balance
is stored. `journey_checkpoint` retains only a legitimately attained display version/level/timestamp,
validated against the history and receipts that existed at that timestamp. SQL prevents decreases.
Migration initializes this peak from actual reconstructed gates, never from a former XP-only peak.
The legacy highest named rank remains separately in the original progression checkpoint.

`completePractice` atomically appends session/award, updates both checkpoints, writes V3/V4 immutable
completion metadata and deletes the matching timer. It returns `{ snapshot, journey, completion }`.
`completion.journey` reports the original before/after level, credits added and date-credit total,
unchanged on duplicate save or reopen. Pre-V4 summaries have null journey feedback: no invented
historical event acknowledgement. Startup validates credit metadata and original before/after levels
against saved session/receipt prefixes at completion time; an unearned milestone fails explicitly.
Retries and uncertain commit recovery use the existing poisoned-connection reopen policy.

`getCurrentPracticeProgress(asOf)` atomically settles legacy progression and returns
`{ snapshot, journey }`; `initialJourney` is the startup equivalent. All UI imports this API, never SQL.
The domain lifetime projection uses lifetime XP, credits, real dates and explicit elapsed time.
The original snapshot supplies the **same consistency factor used by actual earning receipts**.

V4 migration creates the three new tables, then backfills a peak only when migrating from a schema
before V4. On an already-current database, a missing/invalid journey checkpoint fails instead of
recreating one. Frozen completed sessions >=180 seconds can backfill credits and inform **future**
V2 consistency, without awarding old 3–5-minute sessions XP. Malformed historical data fails closed.

`store.application.isExplanationDismissed()` / `.dismissExplanation(explicitTimestamp)` persist the
first dismissal idempotently. `initialExplanationDismissed` restores it. Meditation preferences keep
their original typed shape/defaults. The opening is process-local UI state and is not the explanation.

Future earning changes use new registered configurations and explicit `changeRules`. Future journey
threshold changes need a new display version and an explicit peak migration preserving original
achievement terms; do not edit released thresholds or bypass maximum gates. SQLite stays out of
`src/domain/`; future optional sync can sit above these repositories.

Current hydration/credit validation favors integrity and readability over multi-year optimization.
Credit metadata validation reads session prefixes at startup; profile large histories on devices
before adding incremental summaries. No native filesystem, device failure or signed-build claim is made.
