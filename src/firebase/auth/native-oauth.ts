'use client';

/**
 * @fileOverview Sign in with Apple inside the iOS shell.
 *
 * The website's OAuth path cannot be reused here. `signInWithPopup` needs a
 * popup window a WKWebView does not have, and `signInWithRedirect` leaves
 * through the authDomain — which Safari's storage partitioning then severs, the
 * failure `completeOAuthRedirect()` exists to explain. So the credential is
 * obtained by the *native* Apple sheet through @capacitor-firebase/authentication
 * and handed to the JavaScript SDK to finish.
 *
 * `skipNativeAuth: true` (capacitor.config.ts) is what makes that split safe:
 * the plugin returns Apple's id token without signing the native SDK in, so
 * there is exactly one session — the JS one every hook in this app reads from.
 */

import {
  OAuthProvider,
  signInWithCredential,
  updateProfile,
  type Auth,
} from 'firebase/auth';
import { getPlatform, IS_NATIVE_BUILD } from '@/lib/platform/native';
import { getErrorMessage, type AuthResult } from '@/firebase/auth/actions';

/**
 * Whether to offer the Apple button on this build and device.
 *
 * iOS only. App Store guideline 4.8 is an iOS requirement, and on Android the
 * plugin falls back to a web OAuth flow that needs an Apple *Services ID* and a
 * return URL configured separately — offering a button that depends on setup
 * this project has not done would be a button that fails.
 */
export function isAppleSignInAvailable(): boolean {
  return IS_NATIVE_BUILD && getPlatform() === 'ios';
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
    const message = String(error?.message ?? '');
    if (/cancel/i.test(message) || error?.code === '1001') return { success: false };
    return { success: false, error: getErrorMessage(error) };
  }
}
