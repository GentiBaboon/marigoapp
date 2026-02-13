'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  collection,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreNotification, FirestoreConversation } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConversationListItem, ConversationSkeleton } from '@/components/messages/conversation-list-item';
import Image from 'next/image';
import { MarigoVIcon } from '@/components/icons/MarigoVIcon';
import {
  Bell,
  Tag,
  MessageSquare,
  Package,
  Star,
  PartyPopper,
  X,
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
    // Simplified mapping
    const replacements: Record<string, string> = {
        ' seconds': 's',
        ' second': 's',
        ' minutes': 'm',
        ' minute': 'm',
        ' hours': 'h',
        ' hour': 'h',
        ' days': 'd',
        ' day': 'd',
        ' weeks': 'w',
        ' week': 'w',
        ' months': 'mo',
        ' month': 'mo',
        ' years': 'y',
        ' year': 'y',
    };
    for (const key in replacements) {
        if (distance.endsWith(key)) {
            return distance.replace(key, replacements[key]);
        }
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

function EmptyState({ title, message }: { title: string, message: string}) {
  return (
    <div className="text-center py-20 px-4 flex flex-col items-center justify-center h-full">
      <BellOff className="mx-auto h-16 w-16 text-muted-foreground" />
      <h2 className="mt-6 text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-muted-foreground">{message}</p>
    </div>
  );
}

export default function NotificationsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  // --- Data Fetching ---
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

  const conversationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'conversations'),
        where('participants', 'array-contains', user.uid),
        orderBy('lastMessageAt', 'desc')
    );
  }, [user, firestore]);

  const { data: conversations, isLoading: areConversationsLoading } = useCollection<FirestoreConversation>(conversationsQuery);
  
  const isLoading = isUserLoading || areNotificationsLoading || areConversationsLoading;

  // --- Unread Counts ---
  const unreadUpdatesCount = React.useMemo(() => {
      return notifications?.filter(n => !n.read).length || 0;
  }, [notifications]);

  const unreadMessagesCount = React.useMemo(() => {
      if (!conversations || !user) return 0;
      return conversations.reduce((acc, convo) => {
          return acc + (convo.unreadCount?.[user.uid] || 0);
      }, 0);
  }, [conversations, user]);


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

  return (
    <div className="h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between p-4 border-b">
            <h1 className="text-xl font-bold">Notifications</h1>
            <Button asChild variant="ghost" size="icon">
                <Link href="/home">
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close</span>
                </Link>
            </Button>
        </header>

        <Tabs defaultValue="updates" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 rounded-none h-auto p-0 bg-background border-b">
                <TabsTrigger value="updates" className="h-12 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary text-base text-muted-foreground gap-2">
                    Updates {unreadUpdatesCount > 0 && <Badge className="h-5 px-2">{unreadUpdatesCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="messages" className="h-12 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary text-base text-muted-foreground gap-2">
                    Messages {unreadMessagesCount > 0 && <Badge className="h-5 px-2">{unreadMessagesCount}</Badge>}
                </TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-y-auto">
                <TabsContent value="updates" className="m-0">
                    {isLoading ? (
                        <UpdatesSkeleton />
                    ) : notifications && notifications.length > 0 ? (
                        <div className="divide-y">
                            {notifications.map((notification) => {
                                const Icon = notificationIcons[notification.type] || notificationIcons.default;
                                const content = (
                                    <div className={cn("flex items-center gap-4 p-4")}>
                                        <div className="relative h-10 w-10 flex-shrink-0 flex items-center justify-center">
                                            {notification.data?.imageUrl ? (
                                                <Image src={notification.data.imageUrl} alt={notification.title} fill sizes="40px" className="rounded-md object-cover" />
                                            ) : (
                                                <Icon className="h-8 w-8 text-muted-foreground"/>
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-0.5">
                                            <p className="text-sm font-medium leading-tight">{notification.title}</p>
                                            <p className="text-sm text-muted-foreground leading-tight">{notification.message}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 self-start">
                                            <p className="text-xs text-muted-foreground whitespace-nowrap">
                                                {formatShortDistanceToNow(new Date(notification.createdAt.seconds * 1000))}
                                            </p>
                                            {!notification.read && (
                                                <span className="h-2 w-2 rounded-full bg-red-500 mt-1"></span>
                                            )}
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
                        <EmptyState title="No updates" message="Updates about your items and orders will appear here."/>
                    )}
                </TabsContent>
                <TabsContent value="messages" className="m-0">
                     {isLoading ? (
                        <div className="space-y-2 border-t">
                            <ConversationSkeleton />
                            <ConversationSkeleton />
                            <ConversationSkeleton />
                        </div>
                    ) : conversations && conversations.length > 0 ? (
                        <div className="border-t">
                            {conversations.map(convo => (
                                <ConversationListItem key={convo.id} conversation={convo} currentUserId={user.uid} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState title="No messages" message="Your conversations with other members will appear here." />
                    )}
                </TabsContent>
            </div>
        </Tabs>
    </div>
  );
}
