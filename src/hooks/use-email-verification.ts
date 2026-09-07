'use client';

import { useEffect, useRef } from 'react';
import { doc } from 'firebase/firestore';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { isBannedDoc, isEmailVerifiedClient } from '@/lib/account-verification';

export type AccountStatus = 'loading' | 'signed_out' | 'banned' | 'verified' | 'unverified';

/**
 * The signed-in member's standing, as far as the browser can tell.
 *
 * One live listener on `users/{uid}`, opened for every signed-in visitor:
 * a ban lives on that document and must be seen the moment it lands, not on
 * the next sign-in. `banned` outranks everything. Then verified — from
 * Firebase Auth (Google and Apple accounts are verified by their provider)
 * or from the document — and otherwise `unverified`. `loading` covers both
 * the auth handshake and the read, so a caller never acts on a document
 * that has not arrived.
 *
 * `useDoc` starts with `isLoading: false` and only flips it on in its effect,
 * so on the first render with a reference it looks *finished* with no data.
 * Acting on that frame would bounce every account once per page.
 * `seenLoading` remembers that the read actually started, and the answer is
 * withheld until it has both started and stopped.
 */
export function useEmailVerification(): { status: AccountStatus; email: string | null } {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const uid = user?.uid;
  const ref = useMemoFirebase(
    () => (firestore && uid ? doc(firestore, 'users', uid) : null),
    [firestore, uid],
  );
  const { data, isLoading } = useDoc<{ emailVerified?: boolean; role?: string; status?: string }>(ref);

  const seenLoading = useRef(false);
  useEffect(() => {
    seenLoading.current = false;
  }, [ref]);
  useEffect(() => {
    if (isLoading) seenLoading.current = true;
  }, [isLoading]);

  if (isUserLoading) return { status: 'loading', email: null };
  if (!user) return { status: 'signed_out', email: null };
  if (isLoading || !seenLoading.current) return { status: 'loading', email: user.email };

  if (isBannedDoc(data)) return { status: 'banned', email: user.email };
  return {
    status: isEmailVerifiedClient(user.emailVerified, data) ? 'verified' : 'unverified',
    email: user.email,
  };
}
