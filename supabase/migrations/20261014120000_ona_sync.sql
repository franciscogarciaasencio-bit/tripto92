-- Ona optional account sync (see docs/SYNC.md).
-- Run once in the Supabase SQL editor (or `supabase db push`). Idempotent re-runs are not
-- supported; add a new migration file for future changes.
--
-- Model: per user, a linear revision history of the device ledger. Rows are multi-version:
-- the state at revision R is every row with added_revision <= R and
-- (removed_revision IS NULL OR removed_revision > R). Clients can only SELECT their own rows
-- (row-level security); every write goes through the SECURITY DEFINER functions below.

create table public.ona_ledger_heads (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Identity of this cloud ledger. Deleting the cloud copy removes the head, so a later upload
  -- starts a new ledger with a new identity and phones synced to the old one cannot write to it.
  ledger_id uuid not null default gen_random_uuid(),
  revision bigint not null default 0 check (revision >= 0),
  schema_version integer not null check (schema_version > 0),
  updated_at timestamptz not null default now()
);

create table public.ona_ledger_revisions (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  push_id uuid not null,
  device_id text not null check (device_id ~ '^[0-9a-f]{32}$'),
  kind text not null check (kind in ('upload', 'merge')),
  base_revision bigint not null check (base_revision = revision - 1),
  row_adds integer not null check (row_adds >= 0),
  row_removes integer not null check (row_removes >= 0),
  -- Settlement time (ledger checkpoint asOf, Unix ms) of the state this revision produced.
  as_of bigint not null check (as_of >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, revision),
  unique (user_id, push_id)
);

create table public.ona_ledger_rows (
  user_id uuid not null references auth.users(id) on delete cascade,
  table_name text not null check (table_name in (
    'progression_rules', 'progression_generations', 'meditation_sessions', 'progression_awards',
    'progression_checkpoint', 'practice_completions', 'journey_completions', 'journey_animation_receipts',
    'journey_checkpoint', 'legacy_journey_checkpoint', 'journey_legacy_peaks', 'habit_checkpoints',
    'habit_reward_receipts', 'progression_consistency_activations', 'sync_set_aside_sessions')),
  row_key text not null check (length(row_key) between 1 and 512),
  row_hash text not null check (row_hash ~ '^[0-9a-f]{64}$'),
  row_data jsonb not null check (jsonb_typeof(row_data) = 'object' and pg_column_size(row_data) <= 262144),
  added_revision bigint not null check (added_revision > 0),
  removed_revision bigint check (removed_revision is null or removed_revision > added_revision),
  primary key (user_id, table_name, row_key, added_revision)
);
-- At most one live version of each row.
create unique index ona_ledger_rows_live on public.ona_ledger_rows (user_id, table_name, row_key)
  where removed_revision is null;
create index ona_ledger_rows_added on public.ona_ledger_rows (user_id, added_revision);
create index ona_ledger_rows_removed on public.ona_ledger_rows (user_id, removed_revision)
  where removed_revision is not null;

create table public.ona_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  document text not null check (document in ('meditation_preferences', 'audio_preferences', 'application_preferences')),
  document_data jsonb not null check (jsonb_typeof(document_data) = 'object' and pg_column_size(document_data) <= 16384),
  updated_at bigint not null check (updated_at >= 0),
  device_id text not null check (device_id ~ '^[0-9a-f]{32}$'),
  primary key (user_id, document)
);

alter table public.ona_ledger_heads enable row level security;
alter table public.ona_ledger_revisions enable row level security;
alter table public.ona_ledger_rows enable row level security;
alter table public.ona_settings enable row level security;

-- Supabase grants broad default privileges to anon/authenticated; narrow them explicitly.
revoke all on public.ona_ledger_heads, public.ona_ledger_revisions, public.ona_ledger_rows, public.ona_settings
  from anon, authenticated, public;
grant select on public.ona_ledger_heads, public.ona_ledger_revisions, public.ona_ledger_rows, public.ona_settings
  to authenticated;

create policy ona_ledger_heads_own on public.ona_ledger_heads for select to authenticated
  using (user_id = (select auth.uid()));
create policy ona_ledger_revisions_own on public.ona_ledger_revisions for select to authenticated
  using (user_id = (select auth.uid()));
create policy ona_ledger_rows_own on public.ona_ledger_rows for select to authenticated
  using (user_id = (select auth.uid()));
create policy ona_settings_own on public.ona_settings for select to authenticated
  using (user_id = (select auth.uid()));

-- Atomic compare-and-swap push. Returns {status: applied|duplicate|conflict, revision}.
-- A retried push_id returns its original revision, so a lost response never applies twice.
create function public.ona_push_ledger(
  p_push_id uuid, p_expected_ledger uuid, p_expected_revision bigint, p_device_id text, p_kind text,
  p_schema_version integer, p_as_of bigint, p_removes jsonb, p_adds jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  head bigint;
  ledger uuid;
  existing bigint;
  next_revision bigint;
  item jsonb;
  changed integer;
begin
  if uid is null then raise exception 'Sign in to sync' using errcode = '28000'; end if;
  if p_push_id is null or p_expected_revision is null or p_expected_revision < 0 or p_kind not in ('upload', 'merge')
    or p_schema_version is null or p_schema_version < 1 or p_device_id is null or p_device_id !~ '^[0-9a-f]{32}$'
    or p_as_of is null or p_as_of < 0 or (p_expected_revision > 0 and p_expected_ledger is null)
    or jsonb_typeof(p_removes) is distinct from 'array' or jsonb_typeof(p_adds) is distinct from 'array' then
    raise exception 'Invalid sync push' using errcode = '22023';
  end if;
  if jsonb_array_length(p_removes) + jsonb_array_length(p_adds) > 50000 or octet_length(p_adds::text) > 20000000 then
    raise exception 'Sync push is too large' using errcode = '54000';
  end if;

  insert into public.ona_ledger_heads (user_id, revision, schema_version) values (uid, 0, p_schema_version)
    on conflict (user_id) do nothing;
  -- Serialize this user's pushes, then answer retries of an already applied push.
  select h.revision, h.ledger_id into head, ledger from public.ona_ledger_heads h where h.user_id = uid for update;
  select r.revision into existing from public.ona_ledger_revisions r where r.user_id = uid and r.push_id = p_push_id;
  if found then return jsonb_build_object('status', 'duplicate', 'revision', existing, 'ledgerId', ledger); end if;
  if p_expected_revision > 0 and p_expected_ledger is distinct from ledger then
    return jsonb_build_object('status', 'replaced', 'revision', head, 'ledgerId', ledger);
  end if;
  if head <> p_expected_revision then return jsonb_build_object('status', 'conflict', 'revision', head, 'ledgerId', ledger); end if;

  next_revision := head + 1;
  for item in select value from jsonb_array_elements(p_removes) loop
    if jsonb_typeof(item) is distinct from 'object' then raise exception 'Invalid removal' using errcode = '22023'; end if;
    update public.ona_ledger_rows set removed_revision = next_revision
      where user_id = uid and table_name = item ->> 'table' and row_key = item ->> 'key' and removed_revision is null;
    get diagnostics changed = row_count;
    if changed <> 1 then raise exception 'Sync removal does not match the cloud ledger' using errcode = '22023'; end if;
  end loop;
  for item in select value from jsonb_array_elements(p_adds) loop
    if jsonb_typeof(item) is distinct from 'object' then raise exception 'Invalid addition' using errcode = '22023'; end if;
    -- Constraints validate table names, hashes, sizes; the live index rejects duplicates.
    insert into public.ona_ledger_rows (user_id, table_name, row_key, row_hash, row_data, added_revision)
      values (uid, item ->> 'table', item ->> 'key', item ->> 'hash', item -> 'row', next_revision);
  end loop;

  insert into public.ona_ledger_revisions (user_id, revision, push_id, device_id, kind, base_revision, row_adds, row_removes, as_of)
    values (uid, next_revision, p_push_id, p_device_id, p_kind, head, jsonb_array_length(p_adds), jsonb_array_length(p_removes), p_as_of);
  update public.ona_ledger_heads set revision = next_revision, schema_version = greatest(schema_version, p_schema_version),
    updated_at = now() where user_id = uid;
  return jsonb_build_object('status', 'applied', 'revision', next_revision, 'ledgerId', ledger);
end;
$$;

-- Changes from the state at p_from to the state at p_to (default: head), read under RLS.
-- p_from = 0 returns the complete state at p_to (first download, merge base).
create function public.ona_ledger_changes(p_from bigint, p_to bigint default null) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  head bigint;
  schema integer;
  ledger uuid;
  target bigint;
begin
  if uid is null then raise exception 'Sign in to sync' using errcode = '28000'; end if;
  select h.revision, h.schema_version, h.ledger_id into head, schema, ledger from public.ona_ledger_heads h where h.user_id = uid;
  if not found then head := 0; schema := null; ledger := null; end if;
  target := coalesce(p_to, head);
  if p_from is null or p_from < 0 or p_from > target or target > head then
    raise exception 'Invalid sync revision range' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'revision', target,
    'head', head,
    'ledgerId', ledger,
    'schemaVersion', schema,
    'adds', coalesce((select jsonb_agg(jsonb_build_object('table', r.table_name, 'key', r.row_key, 'hash', r.row_hash, 'row', r.row_data)
        order by r.table_name, r.row_key)
      from public.ona_ledger_rows r where r.user_id = uid and r.added_revision > p_from and r.added_revision <= target
        and (r.removed_revision is null or r.removed_revision > target)), '[]'::jsonb),
    'removes', coalesce((select jsonb_agg(jsonb_build_object('table', r.table_name, 'key', r.row_key) order by r.table_name, r.row_key)
      from public.ona_ledger_rows r where r.user_id = uid and r.added_revision <= p_from
        and r.removed_revision > p_from and r.removed_revision <= target), '[]'::jsonb));
end;
$$;

-- Newest revision <= p_max whose state was settled no later than p_time (0 if none):
-- a base onto which practices from p_time onwards can be replayed in order.
create function public.ona_ledger_revision_before(p_time bigint, p_max bigint) returns bigint
language sql stable security invoker set search_path = '' as $$
  select coalesce(max(r.revision), 0) from public.ona_ledger_revisions r
  where r.user_id = (select auth.uid()) and r.revision <= p_max and r.as_of <= p_time;
$$;

-- Newest edit wins (ties broken by device ID). Returns the stored winner.
create function public.ona_save_setting(p_document text, p_data jsonb, p_updated_at bigint, p_device_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  result public.ona_settings;
begin
  if uid is null then raise exception 'Sign in to sync' using errcode = '28000'; end if;
  insert into public.ona_settings (user_id, document, document_data, updated_at, device_id)
    values (uid, p_document, p_data, p_updated_at, p_device_id)
    on conflict (user_id, document) do update set document_data = excluded.document_data,
      updated_at = excluded.updated_at, device_id = excluded.device_id
      where (excluded.updated_at, excluded.device_id) > (public.ona_settings.updated_at, public.ona_settings.device_id);
  select * into result from public.ona_settings s where s.user_id = uid and s.document = p_document;
  return jsonb_build_object('document', result.document, 'data', result.document_data,
    'updatedAt', result.updated_at, 'deviceId', result.device_id);
end;
$$;

-- Permanently delete this user's cloud copy (devices keep their local data).
create function public.ona_delete_my_cloud_data() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in to sync' using errcode = '28000'; end if;
  delete from public.ona_ledger_rows where user_id = uid;
  delete from public.ona_ledger_revisions where user_id = uid;
  delete from public.ona_ledger_heads where user_id = uid;
  delete from public.ona_settings where user_id = uid;
end;
$$;

revoke all on function public.ona_push_ledger(uuid, uuid, bigint, text, text, integer, bigint, jsonb, jsonb) from public, anon;
revoke all on function public.ona_ledger_revision_before(bigint, bigint) from public, anon;
revoke all on function public.ona_ledger_changes(bigint, bigint) from public, anon;
revoke all on function public.ona_save_setting(text, jsonb, bigint, text) from public, anon;
revoke all on function public.ona_delete_my_cloud_data() from public, anon;
grant execute on function public.ona_push_ledger(uuid, uuid, bigint, text, text, integer, bigint, jsonb, jsonb) to authenticated;
grant execute on function public.ona_ledger_revision_before(bigint, bigint) to authenticated;
grant execute on function public.ona_ledger_changes(bigint, bigint) to authenticated;
grant execute on function public.ona_save_setting(text, jsonb, bigint, text) to authenticated;
grant execute on function public.ona_delete_my_cloud_data() to authenticated;
