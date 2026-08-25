'use client';

import dynamic from 'next/dynamic';
import { collection } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { type FirestoreUser } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { LiveVisitors } from '@/components/admin/analytics/live-visitors';

// recharts is ~200KB and only this half of the page needs it — the live panel
// above renders immediately while this loads.
const UserHistory = dynamic(
  () => import('@/components/admin/analytics/user-history').then((m) => m.UserHistory),
  { loading: () => <Skeleton className="h-[640px] w-full rounded-lg" /> },
);

/**
 * Analytics: who is here now, and who has joined over time.
 *
 * The two halves come from deliberately different places. Live presence is
 * ephemeral and lives in Redis (see src/lib/presence.ts) — it is polled over
 * `/api/presence`, never read from Firestore. Registration history is durable
 * and comes from the `users` collection the admin area already loads.
 */
export default function AdminAnalyticsPage() {
  const firestore = useFirestore();
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading } = useCollection<FirestoreUser>(usersQuery);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl">Analytics</h1>
        <p className="text-muted-foreground mt-1">Live traffic and registration history.</p>
      </div>

      <section className="space-y-4">
        <h2 className="font-headline text-xl">Right now</h2>
        <LiveVisitors />
      </section>

      <section>
        {isLoading ? (
          <Skeleton className="h-[640px] w-full rounded-lg" />
        ) : (
          <UserHistory users={users ?? []} isLoading={isLoading} />
        )}
      </section>
    </div>
  );
}
