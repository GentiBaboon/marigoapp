'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import type { FirestoreUser } from '@/lib/types';
import { isAdminRole, hasPermission, type AdminPermission } from '@/lib/admin-permissions';

export function useAdminAuth() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<string | undefined>(undefined);
  const router = useRouter();

  const userRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: firestoreUser, isLoading: isDocLoading } = useDoc<FirestoreUser>(userRef);

  useEffect(() => {
    if (isUserLoading || isDocLoading) {
      return;
    }

    if (!user) {
      router.replace('/auth/login');
      return;
    }

    const userRole = firestoreUser?.role;
    if (isAdminRole(userRole)) {
      setIsAdmin(true);
      setRole(userRole);
      setIsLoading(false);
    } else {
      setIsAdmin(false);
      setRole(undefined);
      setIsLoading(false);
      router.replace('/home');
    }
  }, [user, isUserLoading, firestoreUser, isDocLoading, router]);

  const can = useCallback(
    (perm: AdminPermission) => hasPermission(role, perm),
    [role]
  );

  return {
    isAdmin,
    isLoading: isUserLoading || isDocLoading || isLoading,
    role,
    can,
  };
}
