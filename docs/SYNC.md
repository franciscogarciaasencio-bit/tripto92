# Optional account sync — design

Status: designed in Session 13 (2026-10-14). Guest use stays fully offline and is the
default. Sync is optional, account-scoped and never required to meditate.

## Goals and non-goals

- Survive reinstalling or replacing a phone: history, immutable awards, rules,
  continuation (current/highest level, Consistency), forest and settings come back.
- Allow occasional use on more than one device without losing practice.
- Never leak one account's data into another account or into guest use.
- Never rewrite synced history because of a formula change (rules stay versioned).
- Non-goals: real-time collaboration, sharing, social features, server-side earning.

## Why not generic last-write-wins

Ona's local database is a validated ledger (ARCHITECTURE.md): immutable sessions and
award receipts plus checkpoints that are *authoritative continuation*, not caches.
Uploading checkpoints with last-write-wins would silently discard another device's
practice or pair a checkpoint with the wrong receipts; recomputing all XP on the
server would violate versioned history. The design keeps the device's own validated
ledger as the unit of truth and gives the cloud a **linear revision history** of it.

## Model

### Ledger rows

`src/data/database/ledger.ts` exports the practice ledger as rows of the fixed table
list below, each with a stable key and a SHA-256 hash of its canonical JSON.

| Table | Key | Notes |
| --- | --- | --- |
| progression_rules | version | frozen rule snapshots |
| progression_generations | id | reset boundary lives here (`boundary_json`) |
| meditation_sessions | id | immutable history |
| progression_awards | id | immutable receipts |
| progression_checkpoint | id | continuation (mutable singleton) |
| practice_completions | session_id | `acknowledged_at` is device UI state and is **not** synced |
| journey_completions, journey_animation_receipts | session_id | immutable |
| journey_checkpoint, legacy_journey_checkpoint | id | highest achievement |
| journey_legacy_peaks, habit_checkpoints | generation_id | |
| habit_reward_receipts | session_id | immutable |
| progression_consistency_activations | generation_id + rules_version | |
| sync_set_aside_sessions | session_id | practices that could not merge (see below) |

Device-only: `meditation_timer`, `schema_migrations`, `sync_*` bookkeeping.

`progression_checkpoint`, `habit_checkpoints` and `journey_checkpoint` are *continuation*
singletons: ordinary reads rewrite them as time passes (decay settlement, `asOf`). A
change confined to them is recomputable by any device from the same history and time,
so it is never pushed on its own and never forces a merge (`isSignificant`). It travels
with the next significant push.
Preferences are synced separately as documents (below).

**Import** (`replaceLedger`) replaces every ledger table inside one transaction and then
runs the same validation as startup (generation states, integrity, journey, habit,
completion receipts). Any inconsistency rolls back and leaves the device unchanged.
Imported completions are marked acknowledged so another device's practice never
reopens a completion screen. Import refuses while a practice is running or a saved
completion has not been acknowledged.

### Cloud (Supabase, Session 14)

Per user: a head revision, an append-only revision log and multi-version rows
(`added_revision`, `removed_revision`). The state at revision R is every row with
`added ≤ R` and (`removed` null or `> R`). Pushes are atomic RPCs with
compare-and-swap on the head revision and an idempotency `push_id`. Row-level security
limits every read to `auth.uid()`; clients cannot write tables directly.

### Local bookkeeping (migration 11)

- `sync_state`: device ID, bound account ID (null for guest), last synced revision,
  one durable in-flight push, last successful sync time.
- `sync_manifest`: the cloud state at the last synced revision (key, hash and content,
  migration 12). Local changes are *derived* by diffing the current export against it, so
  the outbox cannot lose events: a crash before acknowledgement recomputes the same diff.
  Keeping the content means pulls and merges never re-download history already on the phone.
- `sync_document_clocks`: last local edit time of each preference document and the time
  the cloud last confirmed it.

A ledger that records no practice (no sessions, set-aside practices or reset boundary), such
as a brand-new account file, never pushes over or merges with the cloud; it adopts it.
Each revision also records its settlement time (`as_of`), so a merge can find a revision
early enough to replay late-arriving practices in order (`ona_ledger_revision_before`).

### Namespaces

The guest ledger is `meditation.db`. Each account gets its own file named from a hash of
the account ID. Signing in switches files; signing out switches back to guest. A file is
bound to one account (`sync_state.account_id`) and refuses any other, so data cannot
cross accounts even through a bug in the caller.

## Sync cycle (Sessions 16–17, src/application/sync-engine.ts)

Preconditions: signed in, no running/paused practice, no unacknowledged completion.

1. If an in-flight push exists, resend it unchanged (same `push_id`): the server returns
   the original result if it was already applied, so a lost response never duplicates.
2. Pull the diff from the last synced revision S to head H.
3. Diff local rows against the manifest.
4. Cases:
   - nothing significant changed → done;
   - only local changed significantly → push (expected revision S);
   - only remote changed → import state H;
   - both changed, local only in continuation → import H (local time settles again);
   - both changed significantly → **merge**, then push the merged result with expected revision H.
5. A compare-and-swap conflict repeats from 2 (bounded retries with backoff).

### Merge

`planMerge` (database/ledger-merge.ts) compares the stored base S, the cloud head H and
this phone's ledger. Events since S are practices present on only one side and resets
(a changed `progression_generations` boundary).

- **Fast-forward** (common case): no local reset, and every local-only practice starts
  at or after H's settlement time → import H, then complete the local-only practices in
  time order through the normal completion path. Cloud history is untouched.
- **Replay**: otherwise a practice arrived late (made offline before the cloud state's
  settlement time). The engine asks `ona_ledger_revision_before(earliest, H)` for the
  newest revision settled no later than the earliest event, imports that state (from the
  local base when it is S, otherwise downloaded once) and completes every newer practice
  from both sides in time order. Only this window is recalculated; history up to the
  start revision never changes. If no revision is early enough, the replay starts from a
  fresh ledger built exactly as a new install builds one (no reset is invented).
  This is the one place a reward shown on one phone may later differ slightly (for
  example same-day occasion weighting across two offline phones). It is deterministic.
- **Reset**: the latest reset wins; practices that started at or before its boundary are
  deleted (deletion wins, nothing is resurrected). Later practices from both sides replay
  onto the empty ledger.
- **Overlap**: two practices whose times overlap (only possible across phones) cannot
  both enter the ledger. The earlier start is kept; the other is stored in
  `sync_set_aside_sessions` with its full data, so nothing is lost silently.

Merges run in one local transaction, are validated like imports, and are abandoned (and
planned again) if the phone saved anything after planning. The merged result is pushed
with kind `merge`.

### Cloud ledger identity

Each cloud ledger has an identity (`ledger_id`). Deleting the cloud copy removes it; a later
upload starts a new identity whose revision numbers restart. Phones remember the identity
they synced with (migration 13) and every push names it, so a phone synced to a deleted
ledger can never write onto a new one with the same revision numbers
(`SyncCloudReplaced`). The Account screen then offers to save this phone's practice to the
account again (`forgetCloud`, then an upload or a merge) or to remove the account from the phone.

### Settings

Documents: meditation, audio and application preferences. Each records its local edit
time; the newest edit wins on both server (RPC condition) and device.

## First sign-in

| Account in cloud | This device's guest practice | Result |
| --- | --- | --- |
| empty | empty | new account ledger, uploaded |
| empty | has practice | after the first sync, offer to copy this phone's practice into the account |
| has practice | any | account practice is downloaded; guest practice stays in guest |

Guest data is never deleted or merged automatically. Signing out returns to it.

## Leaving

- **Sign out**: returns to guest practice; the account's file stays on the phone and
  syncs again on the next sign-in.
- **Remove this account from this phone**: deletes the phone's account file and signs out.
- **Delete this account's practice**: deletes the cloud copy (`ona_delete_my_cloud_data`)
  and this phone's file, then signs out. Other phones keep their copy and see
  "deleted from another device" instead of re-uploading it.

## Security

- No secrets in the app: only the Supabase URL and publishable (anon) key, which are
  public by design. Google OAuth client secret lives only in Supabase.
- Tokens stored with expo-secure-store. Sign-out clears them.
- RLS on every table; writes only through `security definer` functions that check
  `auth.uid()`, validate table names, key/row sizes and payload limits.
- A person can delete all of their cloud data from the Account screen.

## Capacity (measured, Session 18)

A year of daily practice is about 1.4 MB of ledger rows (365 practices: sessions, awards,
receipts) plus a progression checkpoint that grows to about 130 KB because it lists every
occasion. A first restore downloads the whole year (about 4 s in the in-process test
database). Each later push carries only the new practice's rows plus the changed checkpoint
singletons, so a daily push is small at first and around 130 KB after a year.

The cloud keeps every version of each row so that any past revision can be rebuilt for a
merge. Because the checkpoint is rewritten on every push, storage grows roughly as
(checkpoint size × pushes): about 25 MB per person-year. That is comfortable for the owner and
a small group on Supabase's free 500 MB, but not for many users. **Before wider release**, add
server-side compaction that keeps old checkpoint versions only for a retention window, and
teach merges to set aside (rather than reorder) practice older than that window.

### Phone-side cost (Session 19)

Each sync exports the ledger and hashes rows (pure-JS SHA-256). Measured on a year of daily
practice with Node's JIT disabled (closer to Hermes than a normal Node run): about 0.9 s of
JavaScript per sync before Session 19, on every sync. Now hashes are remembered for the life of
the process (filled only by computation, bounded), the stored base reuses the hashes this phone
saved with it instead of rehashing, and the export yields to the event loop every 200 rows.
The first sync after launch still does one pass but does not freeze touches; later syncs take
about 0.05 s. A wrong stored base hash can only make that row be resent, never hide a change.

## Failure behavior

Offline, server errors or validation failures never block meditation. Sync shows a
quiet status in Settings and retries later. Unknown future ledger formats are refused
with "update Ona" rather than imported.
