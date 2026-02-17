'use client';

import {
  Auth,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';

type AuthResult = {
  success: boolean;
  user?: User | null;
  error?: string;
};

const getErrorMessage = (error: any): string => {
    if (error.code) {
        switch (error.code) {
            case 'auth/user-not-found':
                return 'No user found with this email.';
            case 'auth/wrong-password':
                return 'Incorrect password. Please try again.';
            case 'auth/email-already-in-use':
                return 'This email is already in use by another account.';
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/weak-password':
                return 'Password should be at least 6 characters.';
             case 'auth/popup-closed-by-user':
                return 'Sign-in process was cancelled.';
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

export async function signInWithGoogle(auth: Auth): Promise<AuthResult> {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return { success: true, user: result.user };
  } catch (error: any) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function signInWithApple(auth: Auth): Promise<AuthResult> {
  const provider = new OAuthProvider('apple.com');
  try {
    const result = await signInWithPopup(auth, provider);
    return { success: true, user: result.user };
  } catch (error: any) {
    return { success: false, error: getErrorMessage(error) };
  }
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
