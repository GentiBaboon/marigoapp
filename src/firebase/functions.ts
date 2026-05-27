'use client';

import { getApp } from 'firebase/app';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';

const FUNCTIONS_REGION =
  process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || 'europe-west1';

// Emulator is opt-IN, not auto-on in dev. Set
// NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR=1 in .env.local when you want the
// page to call the local functions emulator. Otherwise we hit the deployed
// Cloud Functions — the right default once functions are live in prod.
function shouldUseEmulator() {
  if (typeof window === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR !== '1') return false;
  // Guard against the flag leaking outside localhost (tunnels, previews).
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

let cached: Functions | null = null;

/** Returns a region-pinned Functions client and wires it to the local
 *  emulator the first time it's called in dev. Safe to call repeatedly —
 *  emulator hookup runs once per page lifetime. */
export function getMarigoFunctions(): Functions {
  if (cached) return cached;
  const fns = getFunctions(getApp(), FUNCTIONS_REGION);
  if (shouldUseEmulator()) {
    try {
      connectFunctionsEmulator(fns, '127.0.0.1', 5001);
      // eslint-disable-next-line no-console
      console.info(`[firebase] Functions client → emulator at 127.0.0.1:5001 (${FUNCTIONS_REGION})`);
    } catch (e) {
      // connectFunctionsEmulator throws if called twice. The cache above
      // means we shouldn't get here, but stay defensive.
      console.warn('[firebase] Functions emulator already connected', e);
    }
  }
  cached = fns;
  return fns;
}
