'use client';
import { useUser } from '@/firebase';
import type { FirestoreMessage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Check, CheckCheck, ShieldCheck } from 'lucide-react';

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

  const isAdmin = message.senderRole === 'admin';
  const isSystem = message.senderRole === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <div className="text-xs text-muted-foreground bg-muted/60 px-3 py-1 rounded-full border">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-end gap-2', isCurrentUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-xs md:max-w-md rounded-2xl px-4 py-2 border',
          isAdmin
            ? 'bg-amber-50 border-amber-300 text-amber-950 rounded-bl-none dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100'
            : isCurrentUser
              ? 'bg-primary text-primary-foreground border-transparent rounded-br-none'
              : 'bg-muted border-transparent rounded-bl-none',
        )}
      >
        {isAdmin && (
          <div className="flex items-center gap-1 mb-1 text-[10px] font-semibold uppercase tracking-wide">
            <ShieldCheck className="h-3 w-3" />
            <span>Marigo Support</span>
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <div className={cn('flex items-center justify-end gap-1 mt-1')}>
          <p
            className={cn(
              'text-xs',
              isAdmin
                ? 'text-amber-900/70 dark:text-amber-100/70'
                : isCurrentUser
                  ? 'text-primary-foreground/70'
                  : 'text-muted-foreground',
            )}
          >
            {format(date, 'p')}
          </p>
          {isCurrentUser &&
            !isAdmin &&
            (message.read ? (
              <CheckCheck className="h-3 w-3 text-primary-foreground/70" />
            ) : (
              <Check className="h-3 w-3 text-primary-foreground/50" />
            ))}
        </div>
      </div>
    </div>
  );
}
