'use client';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import type { FirestoreConversation } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface ConversationListItemProps {
    conversation: FirestoreConversation;
    currentUserId: string;
}

export function ConversationListItem({ conversation, currentUserId }: ConversationListItemProps) {
    
    const otherParticipant = conversation.participantDetails.find(p => p.userId !== currentUserId);

    if (!otherParticipant) return null;

    return (
        <Link href={`/messages/${conversation.id}`} className="block hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-4 p-4 border-b">
                <Avatar className="h-12 w-12">
                    <AvatarImage src={otherParticipant.avatar} alt={otherParticipant.name} />
                    <AvatarFallback>{otherParticipant.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-center">
                        <p className="font-semibold truncate">{otherParticipant.name}</p>
                         <p className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(conversation.lastMessageAt.seconds * 1000), { addSuffix: true })}
                        </p>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{conversation.productTitle}</p>
                    <p className="text-sm text-muted-foreground truncate">{conversation.lastMessage}</p>
                </div>
            </div>
        </Link>
    )
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
