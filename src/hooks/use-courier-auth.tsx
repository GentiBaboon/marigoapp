'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import type { FirestoreUser } from '@/lib/types';

export function useCourierAuth() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const userRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: firestoreUser, isLoading: isFirestoreUserLoading } = useDoc<FirestoreUser>(userRef);

  const [isCourier, setIsCourier] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isUserLoading || isFirestoreUserLoading) {
      return; // Wait for user and profile data to be determined
    }

    if (!user) {
      router.replace('/auth/login');
      return;
    }
    
    if (firestoreUser?.isCourier && firestoreUser?.courierStatus === 'approved') {
        setIsCourier(true);
    } else {
        setIsCourier(false);
        router.replace('/profile'); // Redirect if not an approved courier
    }
    
    setIsLoading(false);

  }, [user, isUserLoading, firestoreUser, isFirestoreUserLoading, router]);

  return { isCourier, isLoading: isUserLoading || isFirestoreUserLoading || isLoading };
}
