'use client';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import type { FirestoreConversation } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { ShieldCheck, Lock } from 'lucide-react';

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
  const isDispute = conversation.source === 'dispute';
  // Fall back to a synthetic "Marigo Support" identity for dispute threads
  // when the current user happens to be the only participant (e.g. an admin
  // who is also the seller in the same account, or a placeholder fixture).
  const otherFromDetails = conversation.participantDetails.find(p => p.userId !== currentUserId);
  const otherParticipant =
    otherFromDetails ||
    (isDispute
      ? ({ userId: 'support', name: 'Marigo Support', avatar: undefined, role: 'admin' } as any)
      : conversation.participantDetails.find(p => (p as any).role === 'admin'));
  const unreadCount = conversation.unreadCount?.[currentUserId] ?? 0;
  const hasUnread = unreadCount > 0;
  const date = tsToDate(conversation.lastMessageAt);

  if (!otherParticipant) return null;

  const isClosed = !!conversation.caseClosed;

  return (
    <Link href={`/messages/${conversation.id}`} className={cn('block hover:bg-muted/50 transition-colors', isDispute && !isClosed && 'bg-amber-50/50')}>
      <div className="flex items-center gap-4 p-4 border-b">
        <div className="relative flex-shrink-0">
          <Avatar className={cn('h-12 w-12', isDispute && 'ring-2 ring-amber-400')}>
            <AvatarImage src={otherParticipant.avatar} alt={otherParticipant.name} />
            <AvatarFallback>{otherParticipant.name.charAt(0)}</AvatarFallback>
          </Avatar>
          {isDispute && (
            <span className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 border-2 border-background">
              {isClosed ? <Lock className="h-2.5 w-2.5" /> : <ShieldCheck className="h-2.5 w-2.5" />}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex justify-between items-center">
            <p className={cn('truncate flex items-center gap-2', hasUnread ? 'font-bold text-foreground' : 'font-semibold')}>
              {otherParticipant.name}
              {isDispute && (
                <span className={cn(
                  'text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-full border',
                  isClosed
                    ? 'bg-muted text-muted-foreground border-muted-foreground/20'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                )}>
                  {isClosed ? `Case ${conversation.caseStatus || 'closed'}` : 'Dispute case'}
                </span>
              )}
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
