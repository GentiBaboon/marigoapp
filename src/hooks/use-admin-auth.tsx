
'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import type { FirestoreUser } from '@/lib/types';

// Define a developer admin UIDs for testing purposes
const DEV_ADMIN_UIDS = [
  '2C81RVoXZWZuSWXEEueehqbHkMu1', 
  'v521MWW9rmPYchVBc91DheeRU5j2',
  'GoNLAq0YYdQw70fDS5L1XbBqtow1',
  '4qTAOIovwdWYGCnqYPiPCJqNcdP2'
];

export function useAdminAuth() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const userRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: firestoreUser, isLoading: isDocLoading } = useDoc<FirestoreUser>(userRef);

  useEffect(() => {
    if (isUserLoading || isDocLoading) {
      return; // Wait for user state to be determined
    }

    if (!user) {
      router.replace('/auth/login');
      return;
    }
    
    // Grant access based on 'role' field in Firestore or dev UIDs
    if (firestoreUser?.role === 'admin' || DEV_ADMIN_UIDS.includes(user.uid)) {
        setIsAdmin(true);
        setIsLoading(false);
    } else {
        setIsAdmin(false);
        setIsLoading(false);
        router.replace('/home');
    }
      
  }, [user, isUserLoading, firestoreUser, isDocLoading, router]);

  return { isAdmin, isLoading: isUserLoading || isDocLoading || isLoading };
}
