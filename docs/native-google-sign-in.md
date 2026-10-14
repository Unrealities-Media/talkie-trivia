# Google sign-in integration

## Implementation, 2026-10-13

Android and iOS now obtain Google ID tokens through the already-installed
`@react-native-google-signin/google-signin` native SDK. Metro selects
`useGoogleIdentity.web.ts` for the existing browser flow. The native path no
longer constructs an Expo browser auth request or depends on a browser redirect.
The web adapter completes its browser auth session and normalizes cancellation.

Native configuration uses the environment's web and iOS OAuth client IDs. It
requests identity only, without offline Google API access or additional scopes.
Android's OAuth client ID is a registration/configuration value, not an accepted
`GoogleSignin.configure` option. The package/signing-certificate registration
must match the installed build. The existing Expo plugin derives the iOS callback
URL scheme from that environment's iOS client ID.

The provider is loaded only when an explicitly configured operation needs it;
guest-only development does not require the native module or placeholder OAuth
requests. Each native attempt checks Play services, clears the SDK's prior account
selection and opens interactive sign-in. SDK sign-out does not sign out Firebase.
User cancellation returns no credential. A missing ID token or provider failure
cannot reach Firebase credential authentication.

The shared account hook retains these safeguards:

- Pending progress must save before linking or signing out. A session change
  during that save prevents opening sign-in for the obsolete session.
- A new Google credential links to the existing anonymous UID. Collisions retain
  the guest and explain the unresolved existing-profile conflict.
- A recovery screen with no active Firebase user can sign in to an existing
  linked profile. This does not implement merging into that profile from a guest.
- Account changes while a provider prompt is open prevent applying its response.
- Linked-account deletion reauthenticates the captured Firebase user, refreshes
  its token and rechecks the UID before submitting deletion. Cancellation or a
  different Google account does not authorize deletion.
- Explicit sign-out clears native provider state before ending the Firebase
  session. Failed cleanup retains Firebase access and permits retry; another
  session arriving during cleanup is not signed out. Guest-only builds skip
  provider cleanup.
- Browser cookies remain controlled by Google. Signing out ends this app's
  Firebase session; it does not sign the browser out of Google globally.

## Verification and remaining release gates

Seven focused suites pass, with 56 tests covering the provider adapters,
Firebase transitions, recovery and account UI. These include native/browser
cancellation, missing tokens, unavailable Play services, cleanup failures,
duplicate taps, failed pending saves, account changes during asynchronous work,
credential collisions, returning-profile recovery and deletion reauthentication
failure. TypeScript and whitespace checks pass. Provider APIs are mocked in these
tests; they do not prove OAuth registration or native prompt behavior.

The isolated Android demo Release build passes for ARM64 and x86_64 in 56 seconds
(50 tasks executed, 950 reused). Its source map includes the native identity
adapter and excludes the Expo Google browser provider; all three copied hook
files match the workspace sources. The unsigned APK SHA-256 is
`d73560628859ea83316a0e01d20b3b77c84bdb3c6b83061d7ba40377635adae1`.
The APK, build log and machine-readable checks are saved under ignored
`.expo/device-proof/native-google-adapter/`. All 56 packaged native libraries
are byte-identical to the preceding readability build, so its 19 unresolved
RELRO failures remain. This artifact was not signed, installed or used to test a
real provider, and it is not a store build. No iOS build result is claimed.

Before release, verify real configured preview builds on Android and iOS:

1. Register the exact application IDs and actual signing fingerprints with Google
   and enable the Firebase provider in the isolated preview project. Repeat for
   production with its separate settings and Play app-signing certificate.
2. Link a fresh guest and confirm its UID, history, pending actions and statistics
   survive. Cancel/retry, reject a different account during deletion, interrupt
   network access, cold-start and sign out/in. Check both provider SDK state and
   Firebase state, not only the displayed account name.
3. Exercise missing/outdated Play services and wrong provider configuration;
   guest play must remain accessible and errors must not expose raw credentials.
4. Verify iOS URL routing, native callback, keychain persistence, reauthentication
   and cancellation on an actual signed build. An Android build cannot prove this.
5. Implement and verify guest-to-existing-profile resolution and Apple sign-in,
   including Apple credential revocation as part of account deletion.

The installed package's Original Google Sign In implementation uses Google's
deprecated Android legacy SDK. Upstream currently documents it as functional;
this integration is not evidence of a completed Credential Manager migration.
Evaluate its replacement and support lifetime before production sign-off. No
paid SDK/license, real account, credential, cloud setting or store submission was
created or changed for this work.

API/setup sources: [Original Google Sign In](https://react-native-google-signin.github.io/docs/original)
and [Expo setup](https://react-native-google-signin.github.io/docs/setting-up/expo).
The implementation was also checked against the installed 16.1.5 source/types.
