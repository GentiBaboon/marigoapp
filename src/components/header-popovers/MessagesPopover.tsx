'use client';

import * as React from 'react';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreConversation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MessageSquare, MessageSquareOff } from 'lucide-react';
import { ConversationListItem } from '@/components/messages/conversation-list-item';

interface Props {
  totalUnread: number;
}

export function MessagesPopover({ totalUnread }: Props) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [open, setOpen] = React.useState(false);

  const conversationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'conversations'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc'),
      limit(15),
    );
  }, [user, firestore]);

  const { data: conversations } = useCollection<FirestoreConversation>(conversationsQuery);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Messages" className="relative">
          <MessageSquare className="h-6 w-6" />
          {totalUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[92vw] max-w-sm p-0">
        <div className="px-3 py-2 border-b">
          <p className="text-sm font-bold">Messages</p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto" onClick={() => setOpen(false)}>
          {!conversations || conversations.length === 0 ? (
            <div className="py-10 px-4 text-center text-sm text-muted-foreground">
              <MessageSquareOff className="mx-auto h-8 w-8 mb-2 opacity-60" />
              No conversations yet.
            </div>
          ) : (
            <div className="divide-y">
              {conversations.map((c) => (
                user && <ConversationListItem key={c.id} conversation={c} currentUserId={user.uid} />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
