'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It throws any received error to be caught by Next.js's global-error.tsx.
 *
 * On admin pages, permission errors are expected (the admin dashboard fires
 * multiple Firestore queries that rely on security rules). These are logged
 * but NOT thrown so they don't crash the entire page via the error boundary.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const handleError = (err: FirestorePermissionError) => {
      // On admin pages, log but don't throw — admin queries handle their own errors
      if (pathname?.startsWith('/admin')) {
        console.warn('[Firestore] Permission error on admin page (non-fatal):', err.message);
        return;
      }
      // Settings docs are public reads — suppress until rules are deployed
      if (err.message?.includes('/settings/')) {
        console.warn('[Firestore] Settings read permission error (non-fatal):', err.message);
        return;
      }
      // Deliveries are queried opportunistically by the order detail pages.
      // A buyer/seller without explicit access just means "no tracking yet" —
      // never crash the page over it.
      if (err.message?.includes('/deliveries')) {
        console.warn('[Firestore] Deliveries read permission error (non-fatal):', err.message);
        return;
      }
      setError(err);
    };

    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [pathname]);

  if (error) {
    throw error;
  }

  return null;
}
