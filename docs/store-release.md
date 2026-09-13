# Store release runbook — App Store & Google Play

Status of the two mobile builds and everything still standing between them and a
published listing. Companion to `CLAUDE.md` §14, which covers how the native
builds work day to day.

**Bundle id: `com.marigoapp.marigo`. Version 1.0.0, build 1.**

---

## 1. What is already done

These are in the repository, or in the Apple Developer account, and need no
further work.

| Item | Where | Why it matters |
|---|---|---|
| Bundle id `com.marigoapp.marigo` | `capacitor.config.ts`, `android/app/build.gradle`, `project.pbxproj` | Permanent once uploaded to either store |
| Apple App ID, same identifier | developer.apple.com, team `6AF53HFAKG` | Push + Sign in with Apple + Apple Pay all enabled on it |
| Apple Merchant ID `merchant.com.marigoapp.marigo` | same | Attached to the App ID's Apple Pay capability |
| APNs auth key, **Key ID `PZ8K649282`** | same; `.p8` downloaded once | Sandbox **&** Production, team-scoped. Apple keeps no copy |
| `App.entitlements` | `ios/App/App/` | `aps-environment`, `applesignin`, `in-app-payments` |
| APNs → FCM exchange | `ios/App/App/AppDelegate.swift` | One `firebase-admin` call then reaches both platforms |
| Device registration + token storage | `src/lib/push/`, `src/components/platform/PushRegistrar.tsx` | Owner-only `users/{uid}/pushTokens` |
| Push fan-out | `functions/src/index.ts` → `sendPushForNotification` | Every existing `notifyUser()` call becomes a push |
| Android notification icon | `res/drawable-*/ic_stat_marigo.png` | Android masks by alpha; the launcher icon would be a white square |
| Sign in with Apple, on device | `src/firebase/auth/native-oauth.ts`, `SocialButtons` | Native sheet → JS SDK, iOS only |
| App icon, iOS 1024² + Android adaptive | `Assets.xcassets/`, `res/mipmap-*/` | Both stores reject the stock placeholder |
| Camera / photo permission strings | `ios/App/App/Info.plist` | iOS **kills the app** on camera access without these |
| Android runtime permissions | `AndroidManifest.xml` | Camera, photos, `POST_NOTIFICATIONS` |
| `camera` declared `required="false"` | same | Otherwise Play hides the app from devices with no camera |
| Privacy manifest | `ios/App/App/PrivacyInfo.xcprivacy` | Without it the upload fails `ITMS-91053` |
| Export-compliance answer | `Info.plist` → `ITSAppUsesNonExemptEncryption` | Skips the question on every upload |
| Release signing | `android/keystore.properties` (gitignored) | Produces a signed `.aab`; absent = unsigned, never a build failure |
| `targetSdk 35` | `android/variables.gradle` | Play's current floor |
| In-app account deletion | `src/app/profile/settings/page.tsx` | Required by App Store guideline 5.1.1(v) |

---

## 2. Blockers — only you can clear these

### 2.1 Firebase config files (blocks push on both platforms)

The apps are registered with Apple but **not yet with Firebase**, and the two
config files are not in the repo. Until they are, push registration fails at
runtime and Sign in with Apple cannot complete — neither fails the build, which
is what makes this easy to miss.

In the Firebase console for `marigoappcom-v10-6377709-d8775` → Project settings
→ *Your apps*:

1. **Add app → iOS**, bundle id `com.marigoapp.marigo`.
   Download `GoogleService-Info.plist` → `ios/App/App/`, then **add it to the
   Xcode target** (drag into the `App` group, "Copy items if needed", target
   *App* ticked). Being on disk is not enough; it has to be in the bundle.
2. **Add app → Android**, package `com.marigoapp.marigo`.
   Download `google-services.json` → `android/app/`. The Gradle plugin picks it
   up on its own — `app/build.gradle` applies it only when the file exists.
3. **Cloud Messaging → Apple app configuration → APNs Authentication Key**:
   upload `AuthKey_PZ8K649282.p8`, Key ID `PZ8K649282`, Team ID `6AF53HFAKG`.
   Without this, iOS devices get a token that no send can reach.
4. **Authentication → Sign-in method → Apple → Enable.** Services ID and the
   OAuth code-flow fields stay empty: they are only needed for the web and
   Android flows, and the app offers Apple on iOS only.

Then rebuild — `npm run sync:native` — because the plist is copied into the app
bundle at build time.

### 2.2 Xcode signing (blocks the iOS upload)

There are **zero code-signing identities** in the keychain
(`security find-identity -v -p codesigning`). Nothing can be archived until
Xcode is signed in:

Xcode → Settings → Accounts → **+** → Apple ID → sign in as the account that
owns team `6AF53HFAKG`. Then open `ios/App/App.xcworkspace`, select the **App**
target → *Signing & Capabilities* → tick "Automatically manage signing" and
choose the team. Xcode then creates the provisioning profile, which is what
actually grants the three entitlements.

### 2.3 Google Play Console

An individual account opened after Nov 2023 must complete **14 days of closed
testing with 12+ testers** before it may publish publicly. Budget for it.

### 2.4 Apple Pay is declared, not wired

The entitlement and merchant id are in place, so the capability ships and
reviews cleanly. There is **no Apple Pay sheet in the checkout**: card payments
are off site-wide (`CARD_PAYMENTS_ENABLED` in `src/lib/payment-options.ts`) and
cash on delivery is the only method offered. Turning it on later needs, in
order: that constant flipped, an Apple Pay Payment Processing **certificate** on
the merchant id (Stripe issues the CSR), and a native payment path — Apple Pay
JS inside a WKWebView is not dependable.

---

## 3. Building the artefacts

### Android — `.aab` for Play

```bash
npm run build:native && npx cap sync android
cd android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`.
Play wants the **`.aab`**, not an `.apk`.

**JDK 17, not the default.** Gradle 8.9 / AGP 8.7.2 refuse to start on the
Java 26 that is first on the PATH here.

### iOS — `.ipa` via Xcode

```bash
npm run sync:native && npx cap open ios
```

Xcode: **Any iOS Device (arm64)** → *Product → Archive* → *Distribute App* →
*App Store Connect*.

**CocoaPods needs a UTF-8 locale** because this project's path contains a
space — without it `pod install` dies with `Encoding::CompatibilityError`. The
npm scripts set `LANG=en_US.UTF-8` themselves; a bare `npx cap sync` does not.

### Verifying a build without signing

```bash
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

Compiles everything and links the pods, which is where breakage actually shows
up. It proves nothing about entitlements — those need a real profile.

---

## 4. Still to do before submitting

Not blockers for building, but each is a plausible rejection or a broken
experience in front of a reviewer.

1. **Test push on a real device.** The simulator has no APNs connection, so
   `registrationError` there is expected and proves nothing. Sign in on a
   device, accept the prompt, confirm a document appears under
   `users/{uid}/pushTokens`, then trigger any order-status change.
2. **Test Sign in with Apple on a real device**, including the "Hide My Email"
   path — the relay address is what lands in the profile.
3. **Splash screen is Capacitor's default**, not Marigo artwork.
4. **Icon master is only 512²**, upscaled to 1024 for iOS. A true 1024² export
   would be better.
5. **Store listing assets** — screenshots (6.7" and 6.5" for Apple; phone and
   tablet for Play), feature graphic (1024×500, Play), description, keywords,
   support URL, marketing URL.
6. **Privacy questionnaires** must match `PrivacyInfo.xcprivacy` and `/privacy`.
   Both stores compare them, and a mismatch is a rejection. Push tokens are new
   since the last pass — declare them.
7. **Age rating** — a C2C marketplace with free-text messaging usually rates
   12+ / Teen. Answer the messaging question honestly.
8. **Demo account for review.** Both stores require working credentials for a
   reviewer. Seed a buyer account with orders and messages and put it in App
   Review notes — a reviewer who cannot get past sign-up rejects.
9. **Deploy the rules and the function**, which a git push does not do:
   ```bash
   firebase deploy --only firestore:rules,functions:sendPushForNotification
   ```

---

## 5. Guideline notes specific to this app

- **Stripe is correct here, and IAP is not.** Apple guideline 3.1.5(a) puts
  physical goods explicitly outside In-App Purchase. Marigo sells physical
  pre-owned items, so external payment is required and no commission is owed on
  GMV. (The App ID carries the In-App Purchase capability because Apple enables
  it on every App ID and it cannot be unticked — the app does not use it.) Do
  not let a reviewer's boilerplate 3.1.1 note go unanswered: reply citing
  3.1.5(a).
- **Guideline 4.8** demands Sign in with Apple only where another third-party
  sign-in is offered. The app offers Apple and email/password on iOS and no
  Google, so it is satisfied twice over.
- **Guideline 4.2 (minimum functionality)** is the real risk for any Capacitor
  app. The bundle ships inside the binary rather than loading a remote URL,
  which is the important half. The other half is native behaviour a website
  cannot have — camera capture, push, haptics — and push is now genuinely
  wired rather than merely installed.
- **`DownloadAppBanner` is suppressed natively** (`isNativeApp()`), so the app
  never invites a user to install the app they are already inside.
