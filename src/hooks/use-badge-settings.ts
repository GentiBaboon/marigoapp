'use client';

import { doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import type { BadgeSettings } from '@/lib/types';

// Subscribes to the admin-editable badge thresholds + labels at settings/badges.
// Components that render seller badges pass the result into getSellerLevel so
// the platform reflects threshold changes live, without a redeploy.
export function useBadgeSettings() {
  const firestore = useFirestore();
  const ref = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'badges') : null),
    [firestore],
  );
  return useDoc<BadgeSettings>(ref);
}
