-- Ona friends (see docs/FRIENDS.md). Run in the Supabase SQL editor after
-- 20261014120000_ona_sync.sql. Safe to run more than once.
--
-- A person adds a friend by email. Once both have added each other, each sees the other's name,
-- level and weeks in a row. Nothing else is shared: no practice, history, times or other friends.
--
-- Privacy model:
-- - Clients cannot read or write these tables (row-level security, no grants). Every operation is
--   a SECURITY DEFINER function that acts only for auth.uid().
-- - A person's own email and name come from their Google sign-in (auth.identities), which Google
--   verified and the person cannot edit; never from the client or editable account metadata. An
--   account without a Google identity (for example email and password) cannot use friends, so nobody
--   can claim someone else's address.
-- - Adding an email never reveals whether it belongs to an Ona account: the answer is 'invited'
--   either way. Another account becomes visible only once it has added you (a request, with its
--   name and email, that you may accept or put aside) or you have added each other (friends).

-- The functions below read Google sign-ins as the role running this file (postgres in the SQL editor).
-- Stop with a clear message, before changing anything, if that role cannot read them.
do $$
begin
  perform 1 from auth.identities limit 1;
exception when insufficient_privilege then
  raise exception 'Ona friends: this role cannot read auth.identities. Run this file in the Supabase SQL editor.';
end;
$$;

create table if not exists public.ona_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (length(email) between 3 and 320),
  -- Matching form of the email (lower case; Gmail without dots or +tags), see ona_email_key.
  email_key text not null check (length(email_key) between 3 and 320),
  display_name text not null check (length(display_name) between 1 and 80),
  -- Shared progress; null until the app first shares it.
  level integer check (level between 0 and 125),
  -- Weeks in a row when shared, and the last day they still hold without more practice (the
  -- sharer's app works it out), so friends see the count lapse when it would (sharedWeeksInARow).
  week_streak integer check (week_streak between 0 and 1000),
  streak_until date,
  shared_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists ona_profiles_email_key on public.ona_profiles (email_key);

-- "from_user added to_email". Two people are friends when each has added the other.
create table if not exists public.ona_friend_requests (
  from_user uuid not null references auth.users(id) on delete cascade,
  to_email_key text not null check (length(to_email_key) between 3 and 320),
  -- As typed (lower case), for the sender's own list of invitations.
  to_email text not null check (length(to_email) between 3 and 320),
  -- The recipient put the request aside ("Not now") or removed the friendship. The sender still
  -- sees an invitation waiting; nothing tells them it was put aside.
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (from_user, to_email_key)
);
create index if not exists ona_friend_requests_to on public.ona_friend_requests (to_email_key);

alter table public.ona_profiles enable row level security;
alter table public.ona_friend_requests enable row level security;
-- Supabase grants broad default privileges to anon/authenticated; no client touches these tables.
revoke all on public.ona_profiles, public.ona_friend_requests from anon, authenticated, public;

-- The form two addresses are compared in: lower case, trimmed; Gmail ignores dots and anything
-- after '+', and googlemail.com is the same mailbox. Null when it is not an email address.
create or replace function public.ona_email_key(p_email text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  address text := lower(btrim(coalesce(p_email, '')));
  local_part text;
  domain text;
begin
  if length(address) > 320 or address !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then return null; end if;
  local_part := split_part(address, '@', 1);
  domain := split_part(address, '@', 2);
  if domain in ('gmail.com', 'googlemail.com') then
    local_part := replace(split_part(local_part, '+', 1), '.', '');
    domain := 'gmail.com';
    if local_part = '' then return null; end if;
  end if;
  return local_part || '@' || domain;
end;
$$;

-- This person's profile, created or refreshed from their Google sign-in (email and name).
create or replace function public.ona_touch_profile() returns public.ona_profiles
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  identity jsonb;
  address text;
  key text;
  name text;
  result public.ona_profiles;
begin
  if uid is null then raise exception 'Sign in to use friends' using errcode = '28000'; end if;
  select i.identity_data into identity from auth.identities i
    where i.user_id = uid and i.provider = 'google'
    order by i.last_sign_in_at desc nulls last, i.created_at desc limit 1;
  address := lower(btrim(identity ->> 'email'));
  key := public.ona_email_key(address);
  if key is null or coalesce(identity ->> 'email_verified', 'true') = 'false' then
    raise exception 'Friends need a Google sign-in' using errcode = '42501';
  end if;
  name := left(btrim(coalesce(nullif(btrim(identity ->> 'full_name'), ''), nullif(btrim(identity ->> 'name'), ''),
    split_part(address, '@', 1))), 80);
  insert into public.ona_profiles (user_id, email, email_key, display_name) values (uid, address, key, name)
    on conflict (user_id) do update set email = excluded.email, email_key = excluded.email_key,
      display_name = excluded.display_name, updated_at = now()
      where (public.ona_profiles.email, public.ona_profiles.email_key, public.ona_profiles.display_name)
        is distinct from (excluded.email, excluded.email_key, excluded.display_name);
  select * into result from public.ona_profiles p where p.user_id = uid;
  return result;
end;
$$;

-- Share this person's level and weeks in a row with their friends.
create or replace function public.ona_share_progress(p_level integer, p_week_streak integer, p_streak_until date)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.ona_profiles;
begin
  -- The sharer's local date may be a day either side of the server's; a streak holds at most two weeks ahead.
  if p_level is null or p_level < 0 or p_level > 125 or p_week_streak is null or p_week_streak < 0 or p_week_streak > 1000
    or p_streak_until is null or p_streak_until < current_date - 2 or p_streak_until > current_date + 16 then
    raise exception 'Invalid progress' using errcode = '22023';
  end if;
  select * into me from public.ona_touch_profile();
  update public.ona_profiles set level = p_level, week_streak = p_week_streak, streak_until = p_streak_until,
    shared_at = now() where user_id = me.user_id;
end;
$$;

-- Friends (each added the other), requests (they added you; you have not added them or put it
-- aside) and invitations (you added them; they have not added you).
create or replace function public.ona_friends() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.ona_profiles;
begin
  select * into me from public.ona_touch_profile();
  return jsonb_build_object(
    'friends', coalesce((select jsonb_agg(jsonb_build_object('id', f.user_id, 'name', f.display_name, 'level', f.level,
        'weeks', f.week_streak, 'weeksUntil', f.streak_until) order by lower(f.display_name), f.user_id)
      from (select distinct p.user_id, p.display_name, p.level, p.week_streak, p.streak_until
        from public.ona_friend_requests mine
        join public.ona_profiles p on p.email_key = mine.to_email_key and p.user_id <> me.user_id
        join public.ona_friend_requests theirs on theirs.from_user = p.user_id and theirs.to_email_key = me.email_key
        where mine.from_user = me.user_id) f), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', p.user_id, 'name', p.display_name, 'email', p.email)
        order by theirs.created_at desc, p.user_id)
      from public.ona_friend_requests theirs
      join public.ona_profiles p on p.user_id = theirs.from_user and p.user_id <> me.user_id
      where theirs.to_email_key = me.email_key and not theirs.hidden
        and not exists (select 1 from public.ona_friend_requests mine
          where mine.from_user = me.user_id and mine.to_email_key = p.email_key)), '[]'::jsonb),
    'invited', coalesce((select jsonb_agg(mine.to_email order by mine.created_at, mine.to_email_key)
      from public.ona_friend_requests mine
      where mine.from_user = me.user_id and not exists (
        select 1 from public.ona_profiles p
        join public.ona_friend_requests theirs on theirs.from_user = p.user_id and theirs.to_email_key = me.email_key
        where p.email_key = mine.to_email_key and p.user_id <> me.user_id)), '[]'::jsonb));
end;
$$;

-- Add a friend by email. Returns {status: 'friends' | 'invited' | 'self'}. 'invited' never says
-- whether the address belongs to an Ona account; 'friends' means they had already added you.
create or replace function public.ona_add_friend(p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.ona_profiles;
  key text := public.ona_email_key(p_email);
  sent integer;
begin
  select * into me from public.ona_touch_profile();
  if key is null then raise exception 'Not an email address' using errcode = '22023'; end if;
  if key = me.email_key then return jsonb_build_object('status', 'self'); end if;
  select count(*) into sent from public.ona_friend_requests r where r.from_user = me.user_id;
  if sent >= 200 and not exists (select 1 from public.ona_friend_requests r where r.from_user = me.user_id and r.to_email_key = key) then
    raise exception 'Too many friends and invitations' using errcode = '54000';
  end if;
  insert into public.ona_friend_requests (from_user, to_email_key, to_email) values (me.user_id, key, lower(btrim(p_email)))
    on conflict (from_user, to_email_key) do nothing;
  return jsonb_build_object('status', case when exists (
      select 1 from public.ona_profiles p
      join public.ona_friend_requests theirs on theirs.from_user = p.user_id and theirs.to_email_key = me.email_key
      where p.email_key = key and p.user_id <> me.user_id) then 'friends' else 'invited' end);
end;
$$;

-- Remove a friend, or put their request aside ("Not now"). They stop seeing you and you stop
-- seeing them; adding each other again later restores the friendship.
create or replace function public.ona_remove_friend(p_friend uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.ona_profiles;
begin
  select * into me from public.ona_touch_profile();
  delete from public.ona_friend_requests r using public.ona_profiles p
    where p.user_id = p_friend and r.from_user = me.user_id and r.to_email_key = p.email_key;
  update public.ona_friend_requests r set hidden = true where r.from_user = p_friend and r.to_email_key = me.email_key;
end;
$$;

-- Withdraw an invitation that has not been answered.
create or replace function public.ona_cancel_invitation(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.ona_profiles;
begin
  select * into me from public.ona_touch_profile();
  delete from public.ona_friend_requests r where r.from_user = me.user_id and r.to_email_key = public.ona_email_key(p_email);
end;
$$;

-- Deleting this account's cloud copy also removes its profile and the friends it added, so nobody
-- sees it any more. (Replaces the version in 20261014120000_ona_sync.sql; grants are kept.)
create or replace function public.ona_delete_my_cloud_data() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in to sync' using errcode = '28000'; end if;
  delete from public.ona_ledger_rows where user_id = uid;
  delete from public.ona_ledger_revisions where user_id = uid;
  delete from public.ona_ledger_heads where user_id = uid;
  delete from public.ona_settings where user_id = uid;
  delete from public.ona_friend_requests where from_user = uid;
  delete from public.ona_profiles where user_id = uid;
end;
$$;

revoke all on function public.ona_email_key(text) from public, anon, authenticated;
revoke all on function public.ona_touch_profile() from public, anon, authenticated;
revoke all on function public.ona_share_progress(integer, integer, date) from public, anon;
revoke all on function public.ona_friends() from public, anon;
revoke all on function public.ona_add_friend(text) from public, anon;
revoke all on function public.ona_remove_friend(uuid) from public, anon;
revoke all on function public.ona_cancel_invitation(text) from public, anon;
grant execute on function public.ona_share_progress(integer, integer, date) to authenticated;
grant execute on function public.ona_friends() to authenticated;
grant execute on function public.ona_add_friend(text) to authenticated;
grant execute on function public.ona_remove_friend(uuid) to authenticated;
grant execute on function public.ona_cancel_invitation(text) to authenticated;
