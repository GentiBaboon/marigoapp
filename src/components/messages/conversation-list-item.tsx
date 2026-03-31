'use client';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import type { FirestoreConversation } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts === 'string') return new Date(ts);
  if (typeof ts === 'object' && 'seconds' in ts) return new Date(ts.seconds * 1000);
  if (ts?.toDate) return ts.toDate();
  return null;
}

interface ConversationListItemProps {
  conversation: FirestoreConversation;
  currentUserId: string;
}

export function ConversationListItem({ conversation, currentUserId }: ConversationListItemProps) {
  const otherParticipant = conversation.participantDetails.find(p => p.userId !== currentUserId);
  const unreadCount = conversation.unreadCount?.[currentUserId] ?? 0;
  const hasUnread = unreadCount > 0;
  const date = tsToDate(conversation.lastMessageAt);

  if (!otherParticipant) return null;

  return (
    <Link href={`/messages/${conversation.id}`} className="block hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-4 p-4 border-b">
        <div className="relative flex-shrink-0">
          <Avatar className="h-12 w-12">
            <AvatarImage src={otherParticipant.avatar} alt={otherParticipant.name} />
            <AvatarFallback>{otherParticipant.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex justify-between items-center">
            <p className={cn('truncate', hasUnread ? 'font-bold text-foreground' : 'font-semibold')}>
              {otherParticipant.name}
            </p>
            <p className="text-xs text-muted-foreground whitespace-nowrap ml-2">
              {date ? formatDistanceToNow(date, { addSuffix: true }) : ''}
            </p>
          </div>
          <p className="text-xs text-muted-foreground truncate">{conversation.productTitle}</p>
          <p className={cn('text-sm truncate', hasUnread ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
            {conversation.lastMessage || 'Start a conversation'}
          </p>
        </div>
        {hasUnread && (
          <div className="flex-shrink-0 bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </div>
    </Link>
  );
}

export function ConversationSkeleton() {
  return (
    <div className="flex items-center space-x-4 p-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
