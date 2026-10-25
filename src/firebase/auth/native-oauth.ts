'use client';

/**
 * @fileOverview Sign in with Apple and Google inside the iOS and Android shells.
 *
 * The website's OAuth path cannot be reused here. `signInWithPopup` needs a
 * popup window a WKWebView does not have, and `signInWithRedirect` leaves
 * through the authDomain — which Safari's storage partitioning then severs, the
 * failure `completeOAuthRedirect()` exists to explain. So the credential is
 * obtained natively through @capacitor-firebase/authentication — Apple's sheet,
 * Google's account picker — and handed to the JavaScript SDK to finish. Google
 * also refuses OAuth inside an embedded WebView outright
 * (`disallowed_useragent`), so for Google there was never a web path to keep.
 *
 * `skipNativeAuth: true` (capacitor.config.ts) is what makes that split safe:
 * the plugin returns Apple's id token without signing the native SDK in, so
 * there is exactly one session — the JS one every hook in this app reads from.
 */

import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  updateProfile,
  type Auth,
} from 'firebase/auth';
import { getPlatform, IS_NATIVE_BUILD } from '@/lib/platform/native';
import { getErrorMessage, type AuthResult } from '@/firebase/auth/actions';

/**
 * Apple on Android. There is no Apple sheet on Android: the plugin runs
 * Firebase's browser flow instead, which needs the Apple provider configured
 * with a Services ID, key and return URL in the Firebase console. Off until
 * that is in place — a button whose setup is missing is a button that fails.
 */
const APPLE_ON_ANDROID = false;

/** Whether to offer the Apple button on this build and device. */
export function isAppleSignInAvailable(): boolean {
  if (!IS_NATIVE_BUILD) return false;
  const platform = getPlatform();
  return platform === 'ios' || (platform === 'android' && APPLE_ON_ANDROID);
}

/**
 * Whether to offer the Google button inside the app (the website has its own).
 *
 * Needs, per platform: iOS — the `CapacitorFirebaseAuthentication/Google` pod
 * and the REVERSED_CLIENT_ID URL scheme in Info.plist; Android —
 * `rgcfaIncludeGoogle` in variables.gradle and the signing key's SHA-1 on the
 * Firebase Android app (without it Google answers DEVELOPER_ERROR, code 10).
 * App Store guideline 4.8 is why Apple must stay beside it on iOS.
 */
export function isGoogleSignInAvailable(): boolean {
  if (!IS_NATIVE_BUILD) return false;
  const platform = getPlatform();
  return platform === 'ios' || platform === 'android';
}

/** A dismissed sheet or picker — not a failure worth telling anyone about. */
export function isCancellation(error: any): boolean {
  const message = String(error?.message ?? '');
  // iOS GoogleSignIn reports -5, Apple 1001, Android Google 12501. Android
  // sends the status as the message alone ("12501: ") with no `code`, which
  // is why the message is checked for the number too.
  const codes = ['1001', '-5', '12501'];
  return (
    /cancel/i.test(message) ||
    codes.includes(String(error?.code ?? '')) ||
    codes.some((code) => new RegExp(`^${code}\\b`).test(message.trim()))
  );
}

export async function signInWithGoogleNative(auth: Auth): Promise<AuthResult> {
  try {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const result = await FirebaseAuthentication.signInWithGoogle({ scopes: ['profile', 'email'] });

    const idToken = result.credential?.idToken;
    if (!idToken) return { success: false };

    const credential = GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
    const signedIn = await signInWithCredential(auth, credential);
    return { success: true, user: signedIn.user };
  } catch (error: any) {
    if (isCancellation(error)) return { success: false };
    return { success: false, error: nativeErrorMessage(error) };
  }
}

/**
 * Google Play services fails with a bare status as the message ("10: " is
 * DEVELOPER_ERROR — the signing key's SHA-1 is not on the Firebase Android
 * app). Shown as a sentence with the number kept for support, rather than as
 * "10: " on its own.
 */
export function nativeErrorMessage(error: any): string {
  const status = /^(-?\d+):/.exec(String(error?.message ?? '').trim());
  if (status && !error?.code) {
    return `Google sign-in could not finish (code ${status[1]}). Please try again, or use your email and password.`;
  }
  return getErrorMessage(error);
}

export async function signInWithAppleNative(auth: Auth): Promise<AuthResult> {
  try {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');

    const result = await FirebaseAuthentication.signInWithApple({
      // Apple only ever releases the name on the *first* authorisation of an
      // app, so a profile created without asking can never be backfilled.
      scopes: ['email', 'name'],
    });

    const idToken = result.credential?.idToken;
    if (!idToken) {
      // The sheet was dismissed, or Apple returned nothing usable. Not an
      // error worth a toast — the person closed it.
      return { success: false };
    }

    // `rawNonce`, not `nonce`: Apple signs the SHA-256 of the nonce into the id
    // token, and Firebase hashes what it is given before comparing. Passing the
    // already-hashed value here fails verification with a misleading
    // "invalid credential".
    const credential = new OAuthProvider('apple.com').credential({
      idToken,
      rawNonce: result.credential?.nonce,
    });

    const signedIn = await signInWithCredential(auth, credential);

    // Apple sends the display name alongside the credential rather than inside
    // the token, so the JS SDK never sees it. Copied across on the first
    // sign-in only — overwriting later would undo a name the member has since
    // edited in their profile.
    const appleName = result.user?.displayName?.trim();
    if (appleName && !signedIn.user.displayName) {
      await updateProfile(signedIn.user, { displayName: appleName }).catch(() => undefined);
    }

    return { success: true, user: signedIn.user };
  } catch (error: any) {
    // The plugin reports a dismissed sheet as a thrown error on both platforms.
    // Treated as a silent cancellation, like the missing-token case above.
    if (isCancellation(error)) return { success: false };
    return { success: false, error: getErrorMessage(error) };
  }
}
