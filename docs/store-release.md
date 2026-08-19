# Store release runbook — App Store & Google Play

Status of the two mobile builds and everything still standing between them and a
published listing. Companion to `CLAUDE.md` §14, which covers how the native
builds work day to day.

---

## 1. What is already done

These are in the repository and need no further work.

| Item | Where | Why it matters |
|---|---|---|
| Bundle id `com.marigoapp.app` | `capacitor.config.ts`, `android/app/build.gradle` | Permanent once uploaded — change it *now* if it is wrong |
| App icon, iOS 1024² | `ios/App/App/Assets.xcassets/AppIcon.appiconset/` | Apple rejects the default placeholder |
| App icon, Android legacy + adaptive | `android/app/src/main/res/mipmap-*/` | Replaces Capacitor's stock icon |
| Adaptive background `#AF63FF` | `android/.../values/ic_launcher_background.xml` | Sampled from the icon so the two layers seam invisibly |
| Camera / photo permission strings | `ios/App/App/Info.plist` | iOS **kills the app** on camera access without these |
| Android runtime permissions | `android/app/src/main/AndroidManifest.xml` | Camera, photos, `POST_NOTIFICATIONS` for push |
| `camera` declared `required="false"` | same | Otherwise Play hides the app from devices with no camera |
| Privacy manifest | `ios/App/App/PrivacyInfo.xcprivacy` | Without it the upload fails `ITMS-91053` |
| Export-compliance answer | `Info.plist` → `ITSAppUsesNonExemptEncryption` | Skips the question on every single upload |
| Release signing scaffold | `android/app/build.gradle` | Reads `keystore.properties`; absent = unsigned, never a build failure |
| Signing material gitignored | `.gitignore` | `*.jks`, `*.keystore`, `keystore.properties` |
| In-app account deletion | `src/app/profile/settings/page.tsx` | Required by App Store guideline 5.1.1(v) — already implemented |

---

## 2. Blockers — only you can clear these

### 2.1 Developer accounts

Neither store accepts an upload without a paid account, and enrolment is not
instant. **Start these first; Apple's review of an enrolment can take days.**

- **Apple Developer Program** — $99/year, <https://developer.apple.com/programs/>
  A *Company* enrolment additionally needs a D-U-N-S number, which can take over
  a week. An *Individual* enrolment is same-day but lists your personal name as
  the seller.
- **Google Play Console** — $25 once, <https://play.google.com/console/signup>
  Individual accounts opened after Nov 2023 must complete 14 days of closed
  testing with 12+ testers before they may publish publicly. Budget for it.

There are currently **zero code-signing identities** in the keychain
(`security find-identity -v -p codesigning` → `0 valid identities found`), so
nothing can be signed until the Apple account exists.

I cannot create accounts or enter credentials on your behalf — these steps are
yours.

### 2.2 Android toolchain is not installed

`~/Library/Android/sdk` does not exist and there is no Android Studio. The
Android app cannot be built at all until it is.

```bash
brew install --cask android-studio
```

Then open it once and let it install the SDK, or install just the command-line
tools and accept the licences.

### 2.3 The installed JDK is too new

```
openjdk 26.0.1
```

The project is on Gradle 8.2.1 / AGP 8.2.1, which support **Java 17**. Gradle
will refuse to start on Java 26. Install a supported JDK and point the build at
it:

```bash
brew install --cask temurin@17
```

Android Studio ships its own JDK and will generally use that, which sidesteps
this for GUI builds but not for command-line ones.

### 2.4 `targetSdk` is below Google's floor — needs a Capacitor upgrade

This is the one that actually prevents a Play submission.

| | Value |
|---|---|
| Project today | `targetSdkVersion = 34` (`android/variables.gradle`) |
| Play floor now | **35** |
| Play floor from ~31 Aug 2026 | **36** |

Capacitor 6 pins Android SDK 34 and cannot be raised in isolation — the Android
platform code is versioned with it. Capacitor **8.5.0** is current. Upgrading is
mandatory for Play, and is best done with the Android SDK already installed so
the result can actually be built and run.

Verify the current floor at
<https://developer.android.com/google/play/requirements/target-sdk> before
starting — Google raises it every August.

### 2.5 Upload keystore (Android)

Create it yourself so the password is never in a transcript or a repo:

```bash
keytool -genkey -v -keystore ~/marigo-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias marigo
```

Then create `android/keystore.properties` (already gitignored):

```
storeFile=/Users/xhenimaloku/marigo-upload.jks
storePassword=…
keyAlias=marigo
keyPassword=…
```

**Back up that `.jks` somewhere durable.** Lose it and you can never publish an
update to the listing again — Play will not accept a differently-signed build.

---

## 3. Building the artefacts, once the above is cleared

### iOS — `.ipa` via Xcode

```bash
npm run sync:native
npx cap open ios
```

In Xcode: select **Any iOS Device (arm64)** → *Product → Archive* → *Distribute
App* → *App Store Connect*. Signing needs your team selected under
*Signing & Capabilities* with "Automatically manage signing" on.

### Android — `.aab` for Play

```bash
npm run build:native && npx cap sync android
cd android && ./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`.
Play wants the **`.aab`**, not an `.apk`.

---

## 4. Still to fix before submitting

Not blockers for building, but each is a plausible rejection or a broken
experience in front of a reviewer.

1. **Google sign-in does not work in a WebView.**
   `signInWithPopup` (`src/firebase/auth/actions.ts:96`) needs a popup window
   that does not exist natively — the button will fail silently on device.
   Needs `@capacitor-firebase/authentication`. Email/password is unaffected.
2. **Push notifications are not wired up.** `@capacitor/push-notifications` is
   installed but nothing registers a token or routes a tap. Android also needs
   `google-services.json`; iOS needs an APNs key and the Push capability.
3. **No `google-services.json`.** `android/app/build.gradle` skips the Google
   Services plugin when it is missing, so push silently cannot work.
4. **Splash screen is Capacitor's default**, not Marigo artwork.
5. **Icon master is only 512²**, upscaled to 1024 for iOS. It is a flat vector-
   style mark so it holds up, but a true 1024² export would be better.
6. **Store listing assets** — screenshots (6.7" and 6.5" for Apple; phone and
   tablet for Play), feature graphic (1024×500, Play), description, keywords,
   support URL, marketing URL.
7. **Privacy questionnaires** must match `PrivacyInfo.xcprivacy` and
   `/privacy`. Apple and Google both compare them, and a mismatch is a rejection.
8. **Age rating** — a C2C marketplace with free-text messaging usually rates 12+
   / Teen. Answer the messaging question honestly.
9. **Demo account for review.** Both stores require working credentials for a
   reviewer. Create a seeded buyer account with orders and messages in it, and
   put it in App Review notes — a reviewer who cannot get past sign-up rejects.

---

## 5. Guideline notes specific to this app

- **Stripe is correct here, and IAP is not.** Apple guideline 3.1.5(a) puts
  physical goods explicitly outside In-App Purchase. Marigo sells physical
  pre-owned items, so external payment is required and no commission is owed on
  GMV. Do not let a reviewer's boilerplate 3.1.1 note go unanswered — reply
  citing 3.1.5(a).
- **Guideline 4.2 (minimum functionality)** is the real risk for any Capacitor
  app. The bundle ships inside the binary rather than loading a remote URL,
  which is the important half. The other half is native behaviour a website
  cannot have — camera capture, push, deep links, haptics. Ship at least push
  and camera before submitting.
- **`DownloadAppBanner` is suppressed natively** (`isNativeApp()`), so the app
  never invites a user to install the app they are already inside.
