# Friends

Owner request (2026-10-17): add friends by email and see, for each, their current level, their
weeks in a row and the symbol of their stage. Nothing else. Reached from Home's top-right icon.

## What is shared

Only with people who have added you **and** whom you have added (mutual), and only:

- the name on your Google account (first name in the list);
- your current level (0–125), shown with your stage's symbol;
- your weeks in a row, as your own calendar counts them.

Never shared: practices, dates, times, durations, Ripples, Consistency, history, other friends.
A friend's stage symbol is shown only if you have reached that stage yourself
(`stageDiscovered`): stages ahead stay undiscovered, as in Journey. Stage names are not shown.

## How adding works

1. You type a friend's email and tap Add. The answer is always "Added" (`invited`) whether or not that
   address uses Ona, so the feature cannot be used to find out who has an account. Ona sends no email.
2. They see a request at the top of their Friends (your name and address) and a small dot on Home's
   Friends icon. "Add back" makes you friends; "Not now" puts it aside without telling you.
3. If they had already added you, adding them makes you friends at once (`friends`).

Addresses are compared the way mail is: case and spaces ignored, and for Gmail also dots, `+tags` and
googlemail.com (`ona_email_key`). Removing a friend (tap their row) works in both directions; adding
each other again restores it. An unanswered invitation can be withdrawn. Deleting your account's
cloud data (Account) also removes your profile and the friends you added. One person can keep at most
200 friends and invitations.

## Weeks in a row without sharing dates

A friend's count must lapse when theirs would, even if their phone stays offline, without sharing the
days they practised. When sharing, the app sends the count and the last day it still holds without
more practice (`sharedStreak`: it replays the streak rules day by day for up to two weeks ahead).
Friends show the count until that day (`sharedWeeksInARow`), then 0. A practice on another phone that
has not synced yet shows once that phone shares.

## When the app shares

While signed in (FriendsProvider, src/application/friends-provider.tsx): once per launch, after each
practice (once its completion screen is closed), after sync brings practice from another phone, and on
return to the app, a moment after things settle. Never during a practice or its completion, never
blocking anything; a failure (offline) waits for the next occasion. Unchanged values are not resent.
The list loads when Friends opens (and pull to refresh), and quietly after launch and on return to the
app at most every five minutes, so Home can show the request dot.

## Server (supabase/migrations/20261017120000_ona_friends.sql)

- `ona_profiles`: per account, email, matching key, Google name, shared level and weeks in a row.
- `ona_friend_requests`: "A added this address"; friends are mutual pairs.
- Clients cannot read or write either table (row-level security, privileges revoked). Everything goes
  through SECURITY DEFINER functions acting only for `auth.uid()`: `ona_share_progress`, `ona_friends`,
  `ona_add_friend`, `ona_remove_friend`, `ona_cancel_invitation`. Helpers `ona_email_key` and
  `ona_touch_profile` are not callable by clients.
- Your own email and name come from your Google sign-in (`auth.identities`), which Google verified and
  you cannot edit; never from the app or editable account metadata. Accounts without a Google sign-in
  (for example email and password) cannot use Friends, so nobody can claim someone else's address.
  The file stops before changing anything if the SQL editor's role cannot read Google sign-ins.
- Shared values are validated (level 0–125, a lapse date within two weeks of today).
- The file is safe to run again. It also replaces `ona_delete_my_cloud_data` to include friends data.

Tests: tests/data/supabase-friends.test.cjs (the SQL on PGlite with Supabase roles),
tests/data/friends-client.test.cjs (the app's client against that database through a PostgREST-shaped
fetch, plus malformed answers), tests/domain/friends.test.cjs (lapse dates match the calendar, stages).

## Setting it up (owner, once)

1. Supabase → SQL Editor → New query: paste all of `supabase/migrations/20261017120000_ona_friends.sql`,
   Run. "Success. No rows returned".
2. Google sign-in is in Testing mode, so only listed test users can sign in. For each friend, add their
   Gmail address in Google Cloud Console → Google Auth Platform → Audience → Test users (up to 100).
   Alternatively, Audience → Publish app makes sign-in open to everyone; Ona asks only for name, email
   and profile, which Google treats as basic scopes. Until the branding is verified, Google's consent
   screen shows the Supabase address instead of "Ona".
3. Publish the over-the-air update. No new APK is needed (no native change).

Until step 1 is done, Friends says it could not be opened; nothing else is affected.
