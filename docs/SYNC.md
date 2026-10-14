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
- `sync_manifest`: row key → hash for the state at the last synced revision. Local
  changes are *derived* by diffing the current export against it, so the outbox cannot
  lose events: a crash before acknowledgement simply recomputes the same diff.
- `sync_document_clocks`: last local edit time of each preference document.

### Namespaces

The guest ledger is `meditation.db`. Each account gets its own file named from a hash of
the account ID. Signing in switches files; signing out switches back to guest. A file is
bound to one account (`sync_state.account_id`) and refuses any other, so data cannot
cross accounts even through a bug in the caller.

## Sync cycle (Sessions 16–17)

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

The base is the cloud state at S (fetched from the server). Events after the base:
practices that exist on only one side, and resets (a changed reset boundary).

- **Fast-forward** (common case): no reset on either side and every local-only
  practice starts after the last remote practice ended → import H, then complete the
  local-only practices in time order through the normal completion path. Remote
  history is untouched; local-only practices earn under current rules.
- **Interleaved**: import the base, then complete every practice after the base from
  both sides in time order. Only this post-fork window is recalculated; practices
  synced before the fork never change. This is the one place where a reward shown on
  one device may later differ slightly (e.g. same-day occasion weighting across two
  offline devices). It is deterministic and documented.
- **Reset**: the latest reset wins; practices that started at or before its boundary are
  deleted (deletion wins, nothing is resurrected). Later practices from both sides are
  replayed onto the empty ledger.
- **Overlap**: two practices whose times overlap (only possible across two devices)
  cannot both enter the ledger. The earlier start is kept; the other is stored in
  `sync_set_aside_sessions` with its full data, so nothing is lost silently.

Merges run in one local transaction and are validated like imports before pushing.

### Settings

Documents: meditation, audio and application preferences. Each records its local edit
time; the newest edit wins on both server (RPC condition) and device.

## First sign-in

| Account in cloud | This device's guest practice | Result |
| --- | --- | --- |
| empty | empty | new account ledger, uploaded |
| empty | has practice | offer to save this device's practice to the account (copy) |
| has practice | any | account practice is downloaded; guest practice stays in guest |

Guest data is never deleted or merged automatically. Signing out returns to it.

## Security

- No secrets in the app: only the Supabase URL and publishable (anon) key, which are
  public by design. Google OAuth client secret lives only in Supabase.
- Tokens stored with expo-secure-store. Sign-out clears them.
- RLS on every table; writes only through `security definer` functions that check
  `auth.uid()`, validate table names, key/row sizes and payload limits.
- A user can delete all of their cloud data from Settings.

## Failure behavior

Offline, server errors or validation failures never block meditation. Sync shows a
quiet status in Settings and retries later. Unknown future ledger formats are refused
with "update Ona" rather than imported.
