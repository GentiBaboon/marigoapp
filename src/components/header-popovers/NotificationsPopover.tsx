'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell, Tag, MessageSquare, Package, Star, PartyPopper, BellOff } from 'lucide-react';
import { MarigoVIcon } from '@/components/icons/MarigoVIcon';

const ICONS: Record<string, React.ElementType> = {
  offer_received: Tag,
  item_sold: Package,
  new_message: MessageSquare,
  order_update: Package,
  review_received: Star,
  welcome: PartyPopper,
  listing_suggestion: MarigoVIcon,
  default: Bell,
};

function shortDistance(date: Date) {
  const d = formatDistanceToNowStrict(date);
  const map: Record<string, string> = {
    ' seconds': 's', ' second': 's',
    ' minutes': 'm', ' minute': 'm',
    ' hours': 'h', ' hour': 'h',
    ' days': 'd', ' day': 'd',
    ' weeks': 'w', ' week': 'w',
    ' months': 'mo', ' month': 'mo',
    ' years': 'y', ' year': 'y',
  };
  for (const k in map) if (d.endsWith(k)) return d.replace(k, map[k]);
  return d;
}

export function NotificationsPopover() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [open, setOpen] = React.useState(false);

  const notificationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
  }, [user, firestore]);

  const { data: notifications } = useCollection<FirestoreNotification>(notificationsQuery);

  const sorted = React.useMemo(() => {
    if (!notifications) return [];
    return [...notifications].sort((a, b) => {
      const ad = toDate(a.createdAt as any)?.getTime() || 0;
      const bd = toDate(b.createdAt as any)?.getTime() || 0;
      return bd - ad;
    });
  }, [notifications]);

  const unread = sorted.filter(n => !n.read).length;

  const markOneRead = (id: string) => {
    if (!firestore) return;
    writeBatch(firestore).update(doc(firestore, 'notifications', id), { read: true }).commit().catch(() => {});
  };

  const markAllRead = () => {
    if (!firestore || sorted.length === 0) return;
    const toMark = sorted.filter(n => !n.read);
    if (toMark.length === 0) return;
    const batch = writeBatch(firestore);
    toMark.forEach(n => batch.update(doc(firestore, 'notifications', n.id), { read: true }));
    batch.commit().catch(() => {});
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[92vw] max-w-sm p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <p className="text-sm font-bold">Notifications</p>
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unread === 0} className="h-7 text-xs">
            Mark all as read
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="py-10 px-4 text-center text-sm text-muted-foreground">
              <BellOff className="mx-auto h-8 w-8 mb-2 opacity-60" />
              No notifications yet.
            </div>
          ) : (
            <div className="divide-y">
              {sorted.map(n => {
                const Icon = ICONS[n.type] || ICONS.default;
                const d = toDate(n.createdAt as any);
                const onClick = () => {
                  if (!n.read) markOneRead(n.id);
                  setOpen(false);
                };
                const body = (
                  <div className="flex items-start gap-3 p-3">
                    <div className="relative h-9 w-9 flex-shrink-0 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                      {n.data?.imageUrl ? (
                        <Image src={n.data.imageUrl} alt={n.title} fill sizes="36px" className="object-cover" />
                      ) : (
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground leading-tight line-clamp-2">{n.message}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{d ? shortDistance(d) : ''}</span>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-red-500" />}
                    </div>
                  </div>
                );
                return n.data?.link ? (
                  <Link key={n.id} href={n.data.link} onClick={onClick} className={cn('block hover:bg-muted/50', !n.read && 'bg-primary/5')}>
                    {body}
                  </Link>
                ) : (
                  <button key={n.id} type="button" onClick={onClick} className={cn('block w-full text-left hover:bg-muted/50', !n.read && 'bg-primary/5')}>
                    {body}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
