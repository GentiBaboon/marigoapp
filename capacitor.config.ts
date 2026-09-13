import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor shell configuration for the iOS and Android apps.
 *
 * The web assets are the static export produced by `npm run build:native`
 * (`NEXT_PUBLIC_BUILD_TARGET=native`), which writes to `.next-native`. Nothing
 * is loaded from the network at startup: the UI ships inside the binary and
 * talks to Firebase and the Vercel API at runtime. Pointing `server.url` at the
 * live site instead would make this a thin web wrapper, which App Store review
 * guideline 4.2 rejects.
 *
 * ⚠️ `appId` is permanent. Once a build is uploaded to App Store Connect or the
 * Play Console the bundle id can never be changed for that listing — only
 * republished as a new app, losing reviews and installs. It must also match
 * the App ID at developer.apple.com and the Firebase iOS/Android apps that
 * issue GoogleService-Info.plist and google-services.json, or push and
 * Apple sign-in fail at runtime with no build error.
 */
const config: CapacitorConfig = {
  appId: 'com.marigoapp.marigo',
  appName: 'MarigoApp',
  webDir: '.next-native',

  ios: {
    // Lets the WebView background match the app background so there is no white
    // flash between the splash screen and the first paint.
    backgroundColor: '#ffffff',
    // 'never', not 'always'. 'always' let UIKit inset the whole WebView, which
    // is safe but paints a flat band above and below the app — and it also
    // means the page never sees the notch, so every `env(safe-area-inset-*)`
    // reports 0 and the CSS insets are dead. Full-bleed hands the layout real
    // numbers and lets the brand colour run under the status bar.
    contentInset: 'never',
  },

  android: {
    backgroundColor: '#ffffff',
    // Keeps the WebView origin at https://localhost, which is what
    // `NATIVE_ORIGINS` in src/middleware.ts allows through CORS.
    allowMixedContent: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#ffffff',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      // Dark glyphs, which is what reads on the light brand purple behind them.
      style: 'LIGHT',
      backgroundColor: '#B884F5',
      // Android only, and false on purpose. iOS goes genuinely edge to edge
      // (contentInset: 'never') because WKWebView reports real safe-area insets
      // to CSS. Android WebView is not dependable about reporting the system
      // bar insets, so letting it overlay risks the tab bar sitting under the
      // gesture bar with nothing compensating. Android keeps the conventional
      // inset layout; the CSS insets there simply resolve to 0.
      overlaysWebView: false,
    },
    Keyboard: {
      // The app already handles its own layout for the on-screen keyboard via
      // useVisualViewport(); resizing the WebView too would double-shrink it.
      resize: 'none',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    FirebaseAuthentication: {
      // The app's auth state lives in the Firebase *JavaScript* SDK — every
      // hook, guard and Firestore call reads from it. Letting the native SDK
      // sign in as well would leave two sessions that drift apart, so the
      // native layer is used only to obtain Apple's credential and the JS SDK
      // completes the sign-in with it (see src/firebase/auth/native-oauth.ts).
      skipNativeAuth: true,
      // Only what the app actually offers. Each entry makes the plugin link
      // and initialise that provider natively; listing one that is not
      // configured in the Firebase console is a runtime failure, not a build
      // one.
      providers: ['apple.com'],
    },
  },
};

export default config;
