'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';

// Define a developer admin UIDs for testing purposes
const DEV_ADMIN_UIDS = ['2C81RVoXZWZuSWXEEueehqbHkMu1', 'v521MWW9rmPYchVBc91DheeRU5j2'];

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
    
    // For development: check for specific UIDs to grant admin access
    if (process.env.NODE_ENV === 'development' && DEV_ADMIN_UIDS.includes(user.uid)) {
        setIsAdmin(true);
        setIsLoading(false);
        return; // Bypass token check for the dev admin
    }


    // Check for admin claim, with a forced refresh as a fallback.
    user.getIdTokenResult()
      .then((idTokenResult) => {
        if (idTokenResult.claims.admin || DEV_ADMIN_UIDS.includes(user.uid)) {
          setIsAdmin(true);
          setIsLoading(false);
        } else {
          // If no admin claim, force a refresh of the token and check again.
          // This is useful when custom claims have just been set.
          user.getIdTokenResult(true).then((refreshedTokenResult) => {
             if (refreshedTokenResult.claims.admin || DEV_ADMIN_UIDS.includes(user.uid)) {
                setIsAdmin(true);
             } else {
                setIsAdmin(false);
                router.replace('/home');
             }
          }).catch(() => {
             setIsAdmin(false);
             router.replace('/home');
          }).finally(() => {
             setIsLoading(false);
          });
        }
      })
      .catch(() => {
        setIsAdmin(false);
        router.replace('/home');
        setIsLoading(false);
      });
      
  }, [user, isUserLoading, router]);

  return { isAdmin, isLoading: isUserLoading || isLoading };
}
