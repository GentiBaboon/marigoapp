'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error'
 * events and logs them together with the simulated request payload, so a denied
 * read can be diffed against firestore.rules.
 *
 * It deliberately does not throw. Every caller of useDoc/useCollection also
 * receives the error locally and renders its own empty state (e.g. "Sale Not
 * Found"), so re-throwing here only replaced that state with a dead-end
 * "Something went wrong!" screen — and forced a suppression list that had to
 * grow a new entry for every collection a page read opportunistically.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (err: FirestorePermissionError) => {
      console.error(
        `[Firestore] Permission denied: ${err.request.method} ${err.request.path}`,
        err
      );
    };

    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null;
}
