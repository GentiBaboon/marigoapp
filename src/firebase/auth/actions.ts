'use client';

import {
  Auth,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  OAuthProvider,
  AuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  updateProfile,
} from 'firebase/auth';

type AuthResult = {
  success: boolean;
  user?: User | null;
  error?: string;
  /**
   * The browser is navigating away to the provider, so there is no outcome yet
   * and nothing to report. Callers must leave their spinner up and show no
   * error — the result arrives via `completeOAuthRedirect()` on the way back.
   */
  redirecting?: boolean;
};

const getErrorMessage = (error: any): string => {
    if (error.code) {
        switch (error.code) {
            case 'auth/user-not-found':
                return 'No user found with this email.';
            case 'auth/wrong-password':
                return 'Incorrect password. Please try again.';
            case 'auth/invalid-credential':
                return 'Invalid email or password. Please check your credentials and try again.';
            case 'auth/email-already-in-use':
                return 'This email is already in use by another account.';
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/weak-password':
                return 'Password should be at least 6 characters.';
            case 'auth/popup-closed-by-user':
            case 'auth/cancelled-popup-request':
                return 'Sign-in process was cancelled.';
            // The site's host is not on the provider's allow-list. This is the
            // usual reason social sign-in works locally and fails in
            // production: add the domain under Firebase Console →
            // Authentication → Settings → Authorized domains.
            case 'auth/unauthorized-domain':
                return 'This site is not authorised for social sign-in yet. Please contact support.';
            case 'auth/popup-blocked':
                return 'Your browser blocked the sign-in window. Please allow pop-ups and try again.';
            // Raised inside the iOS/Android WebView, where neither the popup nor
            // the redirect flow exists. Named rather than folded into the
            // generic message, because otherwise it is indistinguishable from a
            // real failure.
            case 'auth/operation-not-supported-in-this-environment':
            case 'auth/argument-error':
                return 'Social sign-in is not available in the app yet. Please use your email and password.';
            case 'auth/provider-already-linked':
                return 'That account is already linked to this profile.';
            case 'auth/account-exists-with-different-credential':
                return 'An account already exists with the same email but a different sign-in method.';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please try again later.';
            // The account was banned from /admin/users: `syncBanToAuth`
            // disables the Auth user, and this is how a disabled user is
            // told. Deliberately not the generic "check your credentials" —
            // a banned member re-entering the same password ten times learns
            // nothing, and support then hears it as a login bug.
            case 'auth/user-disabled':
                return 'This account has been suspended. Contact hello@marigoapp.com if you think this is a mistake.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your connection and try again.';
            default:
                return 'An unexpected error occurred. Please try again.';
        }
    }
    return error.message || 'An unknown error occurred.';
}

export async function signUpWithEmail(
  auth: Auth,
  email: string,
  password: string,
  name: string
): Promise<AuthResult> {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    await updateProfile(userCredential.user, { displayName: name });
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function signInWithEmail(
  auth: Auth,
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Codes that mean "the popup never opened", as opposed to "the user closed it".
 *
 * Mobile browsers block `window.open` outside a very narrow gesture window, and
 * desktop blockers catch it too, so the popup can fail before the user ever sees
 * a provider screen. Those cases fall back to a full-page redirect.
 *
 * `auth/popup-closed-by-user` and `auth/cancelled-popup-request` are absent on
 * purpose: the person actively dismissed the sheet, and yanking the whole page
 * over to Google in response is the opposite of what they asked for.
 */
const POPUP_UNAVAILABLE_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
]);

/**
 * Popup first, full-page redirect if the popup could not open.
 *
 * The popup keeps the app mounted, which is the better experience where it
 * works — but it is exactly what fails on mobile Safari and Chrome. The
 * redirect always works there, at the cost of leaving and re-entering the app;
 * `completeOAuthRedirect()` is what picks the result back up.
 */
async function signInWithProvider(auth: Auth, provider: AuthProvider): Promise<AuthResult> {
  try {
    const result = await signInWithPopup(auth, provider);
    return { success: true, user: result.user };
  } catch (error: any) {
    if (!POPUP_UNAVAILABLE_CODES.has(error?.code)) {
      return { success: false, error: getErrorMessage(error) };
    }
    try {
      // Navigates away; this promise does not resolve on success.
      await signInWithRedirect(auth, provider);
      return { success: false, redirecting: true };
    } catch (redirectError: any) {
      return { success: false, error: getErrorMessage(redirectError) };
    }
  }
}

/**
 * Finishes a sign-in that went through the redirect path.
 *
 * Without this the redirect is a dead end: the user comes back from Google or
 * Apple, Firebase has the credential waiting, and nothing ever claims it — so
 * they land on the sign-in screen again as if nothing happened. Safe to call on
 * every mount; it resolves to null when there is no pending redirect.
 */
export async function completeOAuthRedirect(auth: Auth): Promise<AuthResult> {
  try {
    const result = await getRedirectResult(auth);
    if (!result) return { success: false };
    return { success: true, user: result.user };
  } catch (error: any) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function signInWithGoogle(auth: Auth): Promise<AuthResult> {
  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  return signInWithProvider(auth, provider);
}

export async function signInWithApple(auth: Auth): Promise<AuthResult> {
  const provider = new OAuthProvider('apple.com');
  // Apple returns nothing beyond an opaque user id unless these are asked for,
  // and it only ever sends the name on the *first* authorisation — so a profile
  // created without them can never be backfilled from Apple.
  provider.addScope('email');
  provider.addScope('name');
  return signInWithProvider(auth, provider);
}

export async function sendPasswordReset(
  auth: Auth,
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function signOutUser(
  auth: Auth
): Promise<{ success: boolean; error?: string }> {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: getErrorMessage(error) };
  }
}
