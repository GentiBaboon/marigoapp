'use client';

import * as React from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { blockPath } from '@/lib/moderation';

/**
 * Whether the signed-in member has blocked `otherUserId`, and the two
 * actions that change it. Only the blocker's own side is visible: whether
 * the other person has blocked *you* is deliberately unreadable (the rules
 * keep `users/{uid}/blocks` owner-only), and shows up only as a refused send.
 */
export function useMemberBlock(otherUserId: string | undefined) {
  const { user } = useUser();
  const firestore = useFirestore();

  const ref = useMemoFirebase(() => {
    if (!user || !firestore || !otherUserId || otherUserId === user.uid) return null;
    return doc(firestore, blockPath(user.uid, otherUserId));
  }, [user, firestore, otherUserId]);

  const { data, isLoading } = useDoc<{ blockedUserId: string }>(ref);

  const block = React.useCallback(
    async (conversationId?: string) => {
      if (!ref || !otherUserId) return;
      await setDoc(ref, {
        blockedUserId: otherUserId,
        ...(conversationId ? { conversationId } : {}),
        createdAt: serverTimestamp(),
      });
    },
    [ref, otherUserId],
  );

  const unblock = React.useCallback(async () => {
    if (ref) await deleteDoc(ref);
  }, [ref]);

  return { isBlocked: !!data, isLoading, block, unblock };
}

export type MemberBlock = ReturnType<typeof useMemberBlock>;
