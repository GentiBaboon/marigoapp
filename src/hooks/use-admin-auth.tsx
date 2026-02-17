'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';

export function useAdminAuth() {
  const { user, isUserLoading } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (isUserLoading) {
      return; // Wait for user state to be determined
    }

    if (!user) {
      router.replace('/auth/login');
      return;
    }

    user.getIdTokenResult()
      .then((idTokenResult) => {
        const isAdminClaim = !!idTokenResult.claims.admin;
        setIsAdmin(isAdminClaim);
        if (!isAdminClaim) {
            router.replace('/home');
        }
      })
      .catch(() => {
        // Error getting token, assume not admin
        setIsAdmin(false);
        router.replace('/home');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [user, isUserLoading, router]);

  return { isAdmin, isLoading: isUserLoading || isLoading };
}
