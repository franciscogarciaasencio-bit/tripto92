# Setting up accounts (Google sign-in + Supabase)

Ona works fully without this. These steps switch on the optional **Account** screen
(Preferences → Account) so practice can be saved to a Google account. Everything here
is free. It takes about 20 minutes, done once, by the owner.

You will create two things:

1. A **Supabase project**: the database that stores each person's saved practice.
2. A **Google OAuth client**: lets people sign in with Google through Supabase.

Only two values end up in the app, and both are public by design: the Supabase project URL
and its **publishable** key. Never put the Google client secret, the database password or a
Supabase **secret** key in the app or in chat. (The app refuses to use a secret key.)

## 1. Create the Supabase project

1. Go to <https://supabase.com>, sign up (free) and click **New project**.
2. Name: `Ona`. Region: **West EU (Ireland)** or **Central EU (Frankfurt)**.
   Choose a strong database password and keep it in a password manager. The app never uses it.
3. Wait for the project to finish creating (about two minutes).

## 2. Create the database tables

1. In the project, open **SQL Editor** → **New query**.
2. Open `supabase/migrations/20261014120000_ona_sync.sql` from this repository, copy all of
   it, paste it into the editor and click **Run**. It should say "Success. No rows returned".
3. Run it only once. Future changes will come as new files.

## 3. Create the Google sign-in client

1. Go to <https://console.cloud.google.com>, sign in, and create a project named `Ona`.
2. Open **APIs & Services → OAuth consent screen** (called "Google Auth Platform" in newer
   consoles). Choose **External**, app name `Ona`, your email as support and developer
   contact. Default scopes (email, profile, openid) are enough. Save.
3. Under **Audience**, either add your Google address as a **test user** (testing only) or
   click **Publish app**. Basic scopes do not need Google's verification review.
4. Open **Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**. Name: `Ona Supabase`.
   - **Authorized redirect URIs**: add `https://<your-project-ref>.supabase.co/auth/v1/callback`.
     Find the exact value in Supabase under **Authentication → Sign In / Providers → Google**
     ("Callback URL").
5. Click **Create** and copy the **Client ID** and **Client secret**.

## 4. Connect Google to Supabase

1. In Supabase: **Authentication → Sign In / Providers → Google** → enable it.
2. Paste the Client ID and Client secret, then save. The secret stays inside Supabase.
3. **Authentication → URL Configuration → Redirect URLs** → add:
   - `meditationapp://auth-callback` (the installed app)
   - `exp://**` (development only; Expo Go must use a tunnel hostname)
   - `http://localhost:8081/auth-callback` (local web testing)

   **Expo Go on a physical phone:** start with `npx expo start --clear --tunnel`,
   then scan the new QR code. The Account screen's development return address must
   use a hostname such as `exp://…exp.direct/--/auth-callback`. Supabase Auth rejects
   non-loopback numeric IP redirects **before** its allow list, so LAN addresses such
   as `exp://192.168.…:8081/--/auth-callback` fall back to the Site URL even with an
   exact allow-list entry. Keep `/--/` in Expo Go; do not substitute the installed
   app's scheme. See [the investigation](AUTH_DEBUG.md).

   Expo may offer to install its official `@expo/ngrok` CLI helper on first tunnel
   use. On this Windows machine with the bundled Node runtime, if Expo cannot find
   the installed global helper, run this in PowerShell before the start command:
   `$env:NODE_PATH = "$env:APPDATA\npm\node_modules"`.

   The Site URL is a fallback, not Google's callback. Ona currently leaves it at
   `http://localhost:3000`; changing it does not make a rejected LAN redirect valid.
   Set it to the real HTTPS website before publishing web sign-in. Use exact
   production callback URLs and remove development entries when no longer needed.

## 5. Give the app its two public values

In Supabase, open **Project Settings → API Keys** (or the **Connect** button) and copy:

- the **Project URL**, e.g. `https://abcdefghijkl.supabase.co`
- the **publishable key**, starting `sb_publishable_` (not the secret key)

Send these two values to Claude (they are safe to share), or add them yourself:

- for Expo Go / local development, a file named `.env` in the project folder:

  ```
  EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijkl.supabase.co
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
  ```

- for APK builds, the same two lines under `build.preview.env` in `eas.json`.

Restart the development server with `npm start -- --clear` after changing `.env`.

## Status for Ona (2026-10-15)

Done by the owner: Supabase project `zmebgjgcmptmivwqumxg` (EU), Google OAuth client
(testing mode, owner as test user), Google provider enabled, redirect URLs, SQL applied.
The public URL and publishable key are in `.env` (Expo Go / development) and in
`eas.json` → `build.preview.env` (APK builds). Publishing the Google app for everyone later
needs a homepage and a privacy policy page.

Debugging confirmed Google itself completed login. The localhost failure was Supabase
Auth's non-loopback IP restriction, not a wrong client secret. The three redirect entries
above are configured. Web uses a same-tab PKCE flow at `/auth-callback`, with browser-only
localStorage for tokens; native still uses the system auth browser and SecureStore.
Same-tab navigation preserves the COOP/COEP headers required by web SQLite. A popup
opener is severed by COOP, so adding only `maybeCompleteAuthSession()` is insufficient.

Web Google → Account email → **Save now** has been exercised in the owner's Chrome.
On 2026-10-15 the owner also confirmed the physical iPhone Expo Go tunnel flow:
"My email appears and Save now completes." Native acceptance comes from that phone
test, separately from the successful web exports. Expo Go sign-in must keep using
`--tunnel`; the default numeric LAN callback remains rejected by Supabase.

## Things to know

- **Free plan pause:** Supabase pauses a free project after about a week with no activity.
  Nothing is deleted; the app simply cannot sync until you click **Restore** in the
  Supabase dashboard. Meditation and local saving are never affected.
- **Deleting cloud data:** each person can delete their own cloud copy from the Account
  screen. You can also see and delete users under **Authentication → Users**.
- **Android backups:** Android's own backup also covers Ona's files on the phone.
  Sign-in tokens are not restored onto a new phone; people simply sign in again.
