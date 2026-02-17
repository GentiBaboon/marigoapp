'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';

// Define a developer admin email for testing purposes
const DEV_ADMIN_EMAIL = 'admin@marigo.app';

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
    
    // For development: check for a specific email to grant admin access
    if (process.env.NODE_ENV === 'development' && user.email === DEV_ADMIN_EMAIL) {
        setIsAdmin(true);
        setIsLoading(false);
        return; // Bypass token check for the dev admin
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
