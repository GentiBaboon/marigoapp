'use client';
import { useUser } from '@/firebase';
import type { FirestoreMessage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Check, CheckCheck } from 'lucide-react';

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts === 'string') return new Date(ts);
  if (typeof ts === 'object' && 'seconds' in ts) return new Date(ts.seconds * 1000);
  if (ts?.toDate) return ts.toDate();
  return null;
}

export function ChatBubble({ message }: { message: FirestoreMessage }) {
  const { user: currentUser } = useUser();
  const isCurrentUser = message.senderId === currentUser?.uid;
  const date = tsToDate(message.createdAt);

  if (!date) return null;

  return (
    <div className={cn('flex items-end gap-2', isCurrentUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-xs md:max-w-md rounded-2xl px-4 py-2',
          isCurrentUser
            ? 'bg-primary text-primary-foreground rounded-br-none'
            : 'bg-muted rounded-bl-none'
        )}
      >
        <p className="text-sm">{message.content}</p>
        <div className={cn('flex items-center justify-end gap-1 mt-1')}>
          <p className={cn('text-xs', isCurrentUser ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
            {format(date, 'p')}
          </p>
          {isCurrentUser && (
            message.read
              ? <CheckCheck className="h-3 w-3 text-primary-foreground/70" />
              : <Check className="h-3 w-3 text-primary-foreground/50" />
          )}
        </div>
      </div>
    </div>
  );
}
