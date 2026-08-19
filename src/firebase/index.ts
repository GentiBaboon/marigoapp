'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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
      firebaseApp = initializeApp(firebaseConfig);
    }

    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

/**
 * Firestore, with a transport the platform can actually use.
 *
 * By default the SDK talks over WebChannel, a long-lived streaming connection.
 * That works in a browser and fails silently inside the iOS/Android WebView —
 * the connection never establishes, no query ever resolves, no error is thrown,
 * and every list in the app sits on its loading skeleton forever. It looks like
 * a slow network rather than a broken one, which is what makes it expensive to
 * diagnose.
 *
 * Long polling trades streaming efficiency for plain HTTP requests that survive
 * the WebView. It is applied only on device; the web build keeps WebChannel.
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
    auth: getAuth(firebaseApp),
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
