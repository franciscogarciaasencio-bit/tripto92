# Google sign-in investigation — 2026-10-15

Baseline: pulled `origin/main` from `666cee4` to `c3c2b60`; working tree was clean.
No native build, migration, reward rule or credential changes are part of this work.
Never record OAuth codes, session tokens or provider secrets here.

## Hypotheses, tests and results

1. **Expo Go redirect rejected. Reproduced.** Dashboard shows Site URL
   `http://localhost:3000`, redirects `exp://**` and `meditationapp://auth-callback`.
   GET `/auth/v1/verify` with an intentionally invalid magic-link token, the public
   apikey header, and URL-encoded redirect produced HTTP 303:

   | Requested redirect | Returned destination before the expected expired-token error |
   | --- | --- |
   | `exp://10.38.180.79:8081/--/auth-callback` (current LAN) | Site URL — rejected |
   | `exp://192.168.1.20:8081/--/auth-callback` (previous attempt) | Site URL — rejected |
   | `exp://192.168.1.2:8081/--/auth-callback` (control) | Site URL — rejected |
   | `exp://abc` | requested URL — accepted |
   | `exp://abc/--/auth-callback` | requested URL — accepted |
   | `exp://abc.exp.direct/--/auth-callback` (tunnel shape) | requested URL — accepted |
   | `meditationapp://auth-callback` | requested URL — accepted |
   | `http://localhost:8081/auth-callback` | requested URL — accepted |
   | `http://127.0.0.1:8081/auth-callback` | requested URL — accepted |
   | `https://example.com/auth-callback` | Site URL — rejected |

   Additional controls: `exp://abc:8081/--/auth-callback` and
   `exp://localhost:8081/--/auth-callback` accepted; numeric LAN host without a port
   rejected. Thus the port and `/--/` are not the cause.

   Native redirect construction is correct: SDK 57 `makeRedirectUri` delegates to
   Linking, which selects `exp` in Expo Go and inserts `/--/`; the configured custom
   scheme is used in an installed build. The iOS WebBrowser implementation listens
   for the returned scheme.

   **Root cause confirmed:** deployed GoTrue `/health` reports `v2.197.0`.
   [Official `IsRedirectURLValid` implementation](https://github.com/supabase/auth/blob/master/internal/utilities/request.go#L89-L130)
   checks `net.ParseIP(refurl.Hostname())` and returns `ip.IsLoopback()` before
   examining the allow list. Numeric non-loopback IPs can never be allowed here.
   `GetReferrer` then returns the Site URL. Do not add exact LAN URLs or weaken security.
   Started Expo with `--clear --tunnel --port 8082`; exact live callback
   `exp://thoh-6i-tripto92-8082.exp.direct/--/auth-callback` accepted (HTTP 303 to itself
   with the intentional expired-token error). This tunnel hostname is temporary.
   Printed both LAN and tunnel redirects by evaluating the installed SDK's actual
   `AuthSession.makeRedirectUri`, Linking `createURL` and `resolveScheme` functions in
   Node with iOS StoreClient constants and each server host. Output exactly matches the
   URLs above; this is SDK construction verification, not a native-device runtime test.
2. **Web token storage fails. Confirmed by installed SDK source.** SecureStore's web
   implementation exports no backend. Existing auth writes therefore fail; reads
   are swallowed as absent. Use a web-only adapter; preserve native keychain storage.
3. **Web callback cannot complete. Confirmed.** No `/auth-callback` route or
   `maybeCompleteAuthSession` handler exists. Ordinary WebBrowser popup completion
   also conflicts with Ona's required COOP `same-origin` SQLite isolation: cross-origin
   OAuth navigation severs the opener. Keep isolation; use same-tab OAuth on web.
4. **Provider secret rotated/wrong; missing Google test-user membership; Google callback
   misconfiguration. Ruled out for the owner's attempts.** Auth log
   `d545da60-b02a-4bb1-bb28-713912651174` at `2026-10-14T21:07:06Z` records Google
   `login`, `/callback`, status 302, referer `http://localhost:3000`, with no provider
   error. Earlier callbacks also record login/signup success. Dashboard confirms Google
   enabled and callback `https://zmebgjgcmptmivwqumxg.supabase.co/auth/v1/callback`.
   Provider secret was left masked and unchanged. Real Google web login also succeeded;
   no client-secret rotation or Google access changes were necessary.
5. **PKCE exchange after return fails. Not the native localhost cause.** Web now stores
   its flow ID per tab and its verifier in browser auth storage, manually exchanges once
   with URL detection disabled, and returns through the provider's normal guest-export /
   account-ledger switch. Duplicate effects reuse the same promise. Real web Google
   return exchanged successfully, showed the owner's email, and Save now completed.
6. **Site URL masks upstream error.** Probe demonstrates fallback. Keep Site URL unchanged
   while collecting logs; no need to change it merely to expose invalid-token controls.
7. **New browser storage permits account mixing across tabs. Prevented.** A tab may
   retain ledger A while another changes shared auth to B. Every RPC now checks the
   current session's user ID against the captured local-ledger account ID; mismatches
   return signed-out with no request. Regression test covers a session switch between RPCs.
8. **Web dev build prevents reproduction. Reproduced existing SDK issue.**
   `npx expo start --web --port 8081 --clear` fails with SQLite `Worker chunk not found`.
   The all-platform production export succeeds; served its unmodified web files locally
   on 8081 with COOP `same-origin` and COEP `credentialless`. This is the real application
   and hosted Supabase backend, without mock auth or replacement storage/database.
9. **Windows CLI tunnel helper cannot resolve. Resolved locally.** Expo installed its
   official `@expo/ngrok` globally, but bundled Node's resolver missed it. Setting
   NODE_PATH to the existing global npm node_modules made `--tunnel` connect. No app
   dependency, lockfile or native configuration was changed.

## Verification

- Supabase URL Configuration now contains installed callback, `exp://**`, and the exact
  `http://localhost:8081/auth-callback`. Site URL unchanged. Loopback redirects were
  already accepted by the server; the explicit entry makes the intended web setup clear.
- Real Chrome flow: Google account chooser → owner's existing test account → same-tab
  callback → Account showing email; automatic sync and explicit Save now both completed.
  Local screenshots are ignored under `.expo/auth-debug/` and contain no credentials.
- First sandbox `npm run check`: typecheck/lint and auth tests passed, but existing
  SQLite integration cleanup hooks hit EPERM. The outside-sandbox rerun reproduced
  four failures: tests registered directory removal before current store closure.
  Windows cannot unlink an open SQLite file. Corrected only those four tests' hook
  registration order, awaiting the current store (including reopened phones) before
  removal. No production persistence, assertions or test coverage was weakened.
  Final `npm run check` passed: TypeScript, ESLint, 515 domain tests and 447 data tests
  (962 total, no failures).
- Final iOS, Android and web exports passed with the per-request account guard. No APK
  built. Web reload retained the signed-in identity and synced successfully again.
- Physical iPhone Expo Go acceptance **confirmed by the owner on 2026-10-15** after
  scanning the live tunnel QR and following Google sign-in → Account → Save now:
  "My email appears and Save now completes." This verifies the native browser return,
  PKCE exchange, account display and authenticated sync on that phone. Google sign-in
  is resolved for the tested web and iPhone Expo Go flows; no APK was built or tested.
- Acceptance follow-up: pulled the owner's later work through `6f62785`, preserved it,
  and changed only these acceptance documents. `npm run check` passed on that revision:
  TypeScript, ESLint, 534 domain + 458 data tests (992 total). No new export was needed
  for this documentation-only closure.
