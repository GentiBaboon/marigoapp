'use client';

import { assertFirebaseConfig, firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage';
import { isNativeApp } from '@/lib/platform/native';

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    // Important! initializeApp() is called without any arguments because Firebase App Hosting
    // integrates with the initializeApp() function to provide the environment variables needed to
    // populate the FirebaseOptions in production. It is critical that we attempt to call initializeApp()
    // without arguments.
    let firebaseApp;
    try {
      // Attempt to initialize via Firebase App Hosting environment variables
      firebaseApp = initializeApp();
    } catch (e) {
      // Only warn in production because it's normal to use the firebaseConfig to initialize
      // during development
      if (process.env.NODE_ENV === "production") {
        console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
      }
      // The no-arg path above only works on Firebase App Hosting, so every other
      // host (Vercel, local dev) lands here and the config object has to be
      // complete. Check before handing it to the SDK: an undefined value would
      // otherwise fail much later as auth/invalid-api-key, repeated once per
      // prerendered page with no indication of which variable is unset.
      assertFirebaseConfig();
      firebaseApp = initializeApp(firebaseConfig);
    }

    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

/**
 * Auth, initialised without the popup/redirect resolver — on every platform.
 *
 * `getAuth()` wires up `browserPopupRedirectResolver` by default. At boot the
 * resolver loads a hidden iframe from the project's authDomain
 * (`/__/auth/iframe.js`, 93 KiB, plus `apis.google.com`'s gapi at another
 * 42 KiB) to look for a pending `signInWithRedirect` result, on **every page
 * for every visitor** — though almost nobody arrives from a redirect, and it
 * only ever matters on the sign-in screen. PageSpeed measured that iframe as
 * the longest critical-path request on the homepage (1.7 s on mobile) and
 * the largest source of unused JavaScript.
 *
 * On the device it was worse than slow: under the `capacitor://` scheme that
 * iframe never finishes loading, so Auth never reaches a ready state — and
 * Firestore asks its app's auth provider for a token *before* it sends
 * anything. A promise that never settles means the query is never issued: no
 * request, no error, no timeout. Every list in the app sat on its loading
 * skeleton because of this, while Firestore itself was healthy.
 *
 * Naming the persistence explicitly skips the resolver at boot. The popup and
 * redirect flows still work on the web: `src/firebase/auth/actions.ts` hands
 * `browserPopupRedirectResolver` to `signInWithPopup`, `signInWithRedirect`
 * and `getRedirectResult` at the call, so the iframe is loaded on the sign-in
 * screen only. On device those flows were never possible — a WebView has no
 * popup to return to; native Google sign-in needs
 * @capacitor-firebase/authentication regardless. Email and password, password
 * reset and session persistence are unaffected: the web persistence list is
 * the same IndexedDB store `getAuth()` used, so existing sessions carry over.
 */
function getPlatformAuth(firebaseApp: FirebaseApp): Auth {
  // During SSR there is nothing to persist and no page to load an iframe
  // into; the default instance is the cheapest thing that satisfies the tree.
  if (typeof window === 'undefined') return getAuth(firebaseApp);

  try {
    return initializeAuth(firebaseApp, {
      persistence: isNativeApp()
        ? indexedDBLocalPersistence
        : [indexedDBLocalPersistence, browserLocalPersistence],
    });
  } catch {
    // Already initialised on an earlier call — settings are fixed by now.
    return getAuth(firebaseApp);
  }
}

/**
 * Firestore, with a transport the platform can actually use.
 *
 * By default the SDK talks over WebChannel, a long-lived streaming connection,
 * which WKWebView handles poorly. Long polling trades streaming efficiency for
 * plain HTTP requests that survive the WebView. Applied only on device; the web
 * build keeps WebChannel.
 *
 * This is belt-and-braces, not the cure for the loading-skeleton bug that was
 * once blamed on it — that was Auth, see `getPlatformAuth` above. Measured on
 * device, a query over long polling returns in ~700ms, so the cost is small
 * enough to keep for the reliability.
 */
function getPlatformFirestore(firebaseApp: FirebaseApp): Firestore {
  if (!isNativeApp()) return getFirestore(firebaseApp);

  try {
    return initializeFirestore(firebaseApp, { experimentalForceLongPolling: true });
  } catch {
    // Firestore was already initialized on an earlier call — its settings are
    // locked in at that point, so just hand back the existing instance.
    return getFirestore(firebaseApp);
  }
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getPlatformAuth(firebaseApp),
    firestore: getPlatformFirestore(firebaseApp),
    storage: getStorage(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
