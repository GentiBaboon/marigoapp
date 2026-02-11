'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  collection,
  query,
  where,
  orderBy,
  doc,
  writeBatch,
} from 'firebase/firestore';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreNotification } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bell,
  Tag,
  MessageSquare,
  Package,
  Star,
  PartyPopper,
  BellOff,
  Check,
} from 'lucide-react';

const notificationIcons: Record<string, React.ElementType> = {
  offer_received: Tag,
  item_sold: Package,
  new_message: MessageSquare,
  order_update: Package,
  review_received: Star,
  welcome: PartyPopper,
};

function NotificationSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-start space-x-4">
          <Skeleton className="h-8 w-8 rounded-full mt-1" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/4 mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20 px-4">
      <BellOff className="mx-auto h-16 w-16 text-muted-foreground" />
      <h2 className="mt-6 text-xl font-semibold">No notifications yet</h2>
      <p className="mt-2 text-muted-foreground">
        Important updates about your activity will appear here.
      </p>
    </div>
  );
}

export default function NotificationsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const notificationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: notifications, isLoading: areNotificationsLoading } =
    useCollection<FirestoreNotification>(notificationsQuery);
    
  const isLoading = isUserLoading || areNotificationsLoading;

  const handleMarkAllAsRead = async () => {
    if (!firestore || !user || !notifications) return;
    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) return;

    const batch = writeBatch(firestore);
    unreadNotifications.forEach(notif => {
        const notifRef = doc(firestore, 'notifications', notif.id);
        batch.update(notifRef, { read: true });
    });

    try {
        await batch.commit();
        toast({ title: "All notifications marked as read." });
    } catch (e) {
        console.error("Failed to mark all notifications as read", e);
        toast({ variant: 'destructive', title: "Error", description: "Could not mark all as read." });
    }
  };


  if (!user && !isUserLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Please sign in to view your notifications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/auth">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const hasUnread = notifications?.some(n => !n.read);

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-headline text-3xl">Notifications</CardTitle>
              <CardDescription>
                Your latest updates from the marketplace.
              </CardDescription>
            </div>
            <Button variant="ghost" onClick={handleMarkAllAsRead} disabled={!hasUnread || isLoading}>
                <Check className="mr-2 h-4 w-4"/>
                Mark all as read
            </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <NotificationSkeleton />
          ) : notifications && notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = notificationIcons[notification.type] || Bell;
                const content = (
                    <div className={cn("flex items-start gap-4 p-4", !notification.read && "bg-primary/5")}>
                        <div className="relative">
                            <Icon className="h-6 w-6 text-muted-foreground mt-1" />
                            {!notification.read && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                </span>
                            )}
                        </div>
                        <div className="flex-1 space-y-1">
                            <p className="font-medium">{notification.title}</p>
                            <p className="text-sm text-muted-foreground">{notification.message}</p>
                            <p className="text-xs text-muted-foreground pt-1">
                                {formatDistanceToNow(new Date(notification.createdAt.seconds * 1000), { addSuffix: true })}
                            </p>
                        </div>
                    </div>
                );
                
                return notification.data?.link ? (
                    <Link key={notification.id} href={notification.data.link} className="block hover:bg-muted/50 transition-colors">
                        {content}
                    </Link>
                ) : (
                    <div key={notification.id}>{content}</div>
                )
              })}
            </div>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
