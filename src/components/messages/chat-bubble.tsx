'use client';
import { useUser } from '@/firebase';
import type { FirestoreMessage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export function ChatBubble({ message }: { message: FirestoreMessage }) {
    const { user: currentUser } = useUser();
    const isCurrentUser = message.senderId === currentUser?.uid;

    if (!message.createdAt) {
        return null; // Don't render messages without a timestamp
    }

    return (
        <div className={cn("flex items-end gap-2", isCurrentUser ? "justify-end" : "justify-start")}>
            <div className={cn(
                "max-w-xs md:max-w-md rounded-2xl px-4 py-2",
                isCurrentUser 
                    ? "bg-primary text-primary-foreground rounded-br-none" 
                    : "bg-muted rounded-bl-none"
            )}>
                <p className="text-sm">{message.content}</p>
                 <p className={cn(
                    "text-xs mt-1", 
                    isCurrentUser ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                    {format(new Date(message.createdAt.seconds * 1000), 'p')}
                </p>
            </div>
        </div>
    );
}
