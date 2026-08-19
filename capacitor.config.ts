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
 * republished as a new app, losing reviews and installs. Change it now if
 * `com.marigoapp.app` is not what you want.
 */
const config: CapacitorConfig = {
  appId: 'com.marigoapp.app',
  appName: 'MarigoApp',
  webDir: '.next-native',

  ios: {
    // Lets the WebView background match the app background so there is no white
    // flash between the splash screen and the first paint.
    backgroundColor: '#ffffff',
    contentInset: 'always',
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
      // Dark glyphs on the light brand background.
      style: 'LIGHT',
      backgroundColor: '#ffffff',
    },
    Keyboard: {
      // The app already handles its own layout for the on-screen keyboard via
      // useVisualViewport(); resizing the WebView too would double-shrink it.
      resize: 'none',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
