'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreNotification } from '@/lib/types';
import { toDate } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { MarigoVIcon } from '@/components/icons/MarigoVIcon';
import {
  Bell,
  Tag,
  MessageSquare,
  Package,
  Star,
  PartyPopper,
  BellOff
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const notificationIcons: Record<string, React.ElementType> = {
  offer_received: Tag,
  item_sold: Package,
  new_message: MessageSquare,
  order_update: Package,
  review_received: Star,
  welcome: PartyPopper,
  listing_suggestion: MarigoVIcon,
  default: Bell,
};

function formatShortDistanceToNow(date: Date) {
    const distance = formatDistanceToNowStrict(date);
    const replacements: Record<string, string> = {
        ' seconds': 's', ' second': 's',
        ' minutes': 'm', ' minute': 'm',
        ' hours': 'h', ' hour': 'h',
        ' days': 'd', ' day': 'd',
        ' weeks': 'w', ' week': 'w',
        ' months': 'mo', ' month': 'mo',
        ' years': 'y', ' year': 'y',
    };
    for (const key in replacements) {
        if (distance.endsWith(key)) return distance.replace(key, replacements[key]);
    }
    return distance;
}

function UpdatesSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20 px-4 flex flex-col items-center justify-center">
      <BellOff className="mx-auto h-16 w-16 text-muted-foreground" />
      <h2 className="mt-6 text-xl font-semibold">No updates</h2>
      <p className="mt-2 text-muted-foreground">Updates about your items and orders will appear here.</p>
    </div>
  );
}

export default function NotificationsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const notificationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  }, [user, firestore]);

  const { data: notifications, isLoading: areNotificationsLoading } =
    useCollection<FirestoreNotification>(notificationsQuery);

  const markOneRead = React.useCallback(
    (id: string) => {
      if (!firestore) return;
      writeBatch(firestore)
        .update(doc(firestore, 'notifications', id), { read: true })
        .commit()
        .catch(() => {});
    },
    [firestore],
  );

  const markAllRead = React.useCallback(() => {
    if (!firestore || !notifications) return;
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(firestore);
    unread.forEach(n => batch.update(doc(firestore, 'notifications', n.id), { read: true }));
    batch.commit().catch(() => {});
  }, [firestore, notifications]);

  const sortedNotifications = React.useMemo(() => {
    if (!notifications) return notifications;
    return [...notifications].sort((a, b) => {
      const ad = toDate(a.createdAt as any)?.getTime() || 0;
      const bd = toDate(b.createdAt as any)?.getTime() || 0;
      return bd - ad;
    });
  }, [notifications]);

  const unreadCount = React.useMemo(() => notifications?.filter(n => !n.read).length || 0, [notifications]);

  const isLoading = isUserLoading || areNotificationsLoading;

  if (!user && !isUserLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Please sign in to view your notifications.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link href="/auth">Sign In</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      <div className="px-4 pt-4 pb-0 border-b">
        <h1 className="text-xl font-bold mb-4">Notifications</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <UpdatesSkeleton />
        ) : sortedNotifications && sortedNotifications.length > 0 ? (
          <div className="divide-y">
            <div className="flex justify-end px-4 pt-3">
              <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
                Mark all as read
              </Button>
            </div>
            {sortedNotifications.map((notification) => {
              const Icon = notificationIcons[notification.type] || notificationIcons.default;
              const content = (
                <div className={cn("flex items-center gap-4 p-4")}>
                  <div className="relative h-10 w-10 flex-shrink-0 flex items-center justify-center">
                    {notification.data?.imageUrl ? (
                      <Image src={notification.data.imageUrl} alt={notification.title} fill sizes="40px" className="rounded-md object-cover" />
                    ) : (
                      <Icon className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <p className="text-sm font-medium leading-tight">{notification.title}</p>
                    <p className="text-sm text-muted-foreground leading-tight">{notification.message}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 self-start">
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {(() => {
                        const d = toDate(notification.createdAt as any);
                        return d ? formatShortDistanceToNow(d) : '';
                      })()}
                    </p>
                    {!notification.read && <span className="h-2 w-2 rounded-full bg-red-500 mt-1" />}
                  </div>
                </div>
              );

              const handleClick = () => { if (!notification.read) markOneRead(notification.id); };
              return notification.data?.link ? (
                <Link key={notification.id} href={notification.data.link} onClick={handleClick} className="block hover:bg-muted/50 transition-colors">
                  {content}
                </Link>
              ) : (
                <button key={notification.id} type="button" onClick={handleClick} className="block w-full text-left hover:bg-muted/50 transition-colors">
                  {content}
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}
