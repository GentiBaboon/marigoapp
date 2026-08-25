'use client';

import { usePresence } from '@/hooks/use-presence';

/**
 * Mounts the visitor heartbeat. Renders nothing.
 *
 * A component rather than a hook call in the layout because the root layout is
 * a server component — and it needs to sit *inside* FirebaseClientProvider, so
 * a signed-in visitor's heartbeat can carry their token and show up on the
 * live view by name rather than as an anonymous session.
 */
export function PresenceTracker() {
  usePresence();
  return null;
}
