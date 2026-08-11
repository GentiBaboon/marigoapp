'use client';

import * as React from 'react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, updateDoc, writeBatch, getDocs, where } from 'firebase/firestore';
import { disputeKindLabel, type FirestoreConversation, type FirestoreMessage } from '@/lib/types';
import { ChatHeader } from '@/components/messages/chat-header';
import { ChatBubble } from '@/components/messages/chat-bubble';
import { ChatInput } from '@/components/messages/chat-input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock } from 'lucide-react';

function ChatSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="flex justify-end"><Skeleton className="h-12 w-48 rounded-2xl" /></div>
      <div className="flex justify-start"><Skeleton className="h-16 w-64 rounded-2xl" /></div>
      <div className="flex justify-end"><Skeleton className="h-8 w-32 rounded-2xl" /></div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="flex justify-start"
    >
      <div className="bg-muted rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-1">
        {[0, 0.15, 0.3].map((delay, i) => (
          <motion.div
            key={i}
            className="h-2 w-2 rounded-full bg-muted-foreground/60"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay }}
          />
        ))}
      </div>
    </motion.div>
  );
}

export default function ChatPage({ params }: { params: { conversationId: string } }) {
  const { conversationId } = params;
  const { user } = useUser();
  const firestore = useFirestore();
  const listRef = React.useRef<HTMLDivElement>(null);
  const hasScrolledOnce = React.useRef(false);
  const hasMarkedRead = React.useRef(false);

  const conversationRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'conversations', conversationId);
  }, [firestore, conversationId]);

  const { data: conversation, isLoading: isConversationLoading } = useDoc<FirestoreConversation>(conversationRef);

  const messagesQuery = useMemoFirebase(() => {
    if (!conversationRef) return null;
    return query(collection(conversationRef, 'messages'), orderBy('createdAt', 'asc'));
  }, [conversationRef]);

  const { data: messages } = useCollection<FirestoreMessage>(messagesQuery);

  const isDisputeConv = conversation?.source === 'dispute';
  const fallbackOtherUser = isDisputeConv
    ? ({ userId: 'support', name: 'Marigo Support', avatar: '/app-icon.png' } as any)
    : undefined;
  // For dispute threads, always present the support identity (logo +
  // "Marigo Support") instead of the stored admin name/photo so buyers
  // and sellers never see an internal email address.
  const rawOther = conversation?.participantDetails.find(p => p.userId !== user?.uid) || fallbackOtherUser;
  const otherUser = isDisputeConv && rawOther
    ? { ...rawOther, name: 'Marigo Support', avatar: '/app-icon.png' }
    : rawOther;
  const otherUserId = otherUser?.userId;

  // Detect if the other user is typing
  const otherUserTyping = otherUserId
    ? (conversation as any)?.typing?.[otherUserId] === true
    : false;

  // Mark unread messages as read AND clear the user's unreadCount on open.
  // The count is always reset, even if every message is already flagged read,
  // so the bell badge clears for cases where the count drifted out of sync
  // (e.g. dispute mirrors where senderId == currentUser.uid).
  React.useEffect(() => {
    if (!user || !firestore || !messages || !conversation || hasMarkedRead.current) return;
    hasMarkedRead.current = true;

    const batch = writeBatch(firestore);

    const unreadFromOther = messages.filter(m => m.senderId !== user.uid && !m.read);
    unreadFromOther.forEach(m => {
      const msgRef = doc(firestore, 'conversations', conversationId, 'messages', m.id);
      batch.update(msgRef, { read: true });
    });

    const currentCount = conversation.unreadCount?.[user.uid] ?? 0;
    if (conversationRef && (currentCount > 0 || unreadFromOther.length > 0)) {
      batch.update(conversationRef, { [`unreadCount.${user.uid}`]: 0 });
    }

    if (unreadFromOther.length > 0 || currentCount > 0) {
      batch.commit().catch(() => {/* ignore */});
    }
  }, [messages, user, firestore, conversationId, conversationRef, conversation]);

  // Scroll to bottom on new messages. Driving the list's own scrollTop rather
  // than scrollIntoView: the latter walks up the ancestor chain and would drag
  // the whole page on mobile, where the thread is meant to be the only thing
  // that scrolls.
  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: hasScrolledOnce.current ? 'smooth' : 'auto' });
    hasScrolledOnce.current = true;
  }, [messages, otherUserTyping]);

  if (isConversationLoading) {
    return (
      <Card className="h-full flex flex-col rounded-none border-x-0 border-y-0 md:rounded-lg md:border">
        <ChatSkeleton />
      </Card>
    );
  }

  const isDispute = conversation?.source === 'dispute';
  const isClosed = !!conversation?.caseClosed;

  return (
    // Edge-to-edge on a phone: rounded corners and side borders only make
    // sense once the card is inset from the viewport at md.
    <Card className="h-full flex flex-col overflow-hidden rounded-none border-x-0 border-y-0 md:rounded-lg md:border">
      {otherUser && conversation && (
        <ChatHeader
          user={otherUser}
          product={{ id: conversation.productId, title: conversation.productTitle, image: conversation.productImage }}
          isTyping={otherUserTyping}
        />
      )}

      {isDispute && (
        <div
          className={
            isClosed
              ? 'bg-muted text-muted-foreground border-b px-4 py-2 text-xs flex items-center gap-2'
              : 'bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs flex items-center gap-2 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100'
          }
        >
          {isClosed ? <Lock className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          <span className="font-semibold">
            {(() => {
              const kind = disputeKindLabel(conversation?.disputeKind);
              if (isClosed) {
                return `${kind} ${conversation?.caseStatus || 'closed'} — this thread is read-only.`;
              }
              return `${kind} in progress — handled by Marigo Support.`;
            })()}
          </span>
        </div>
      )}

      {/* min-h-0 lets this flex child actually shrink so it — not the page —
          is what scrolls; overscroll-contain stops a swipe past the top from
          scroll-chaining to the document behind it. */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 md:px-4 space-y-2"
      >
        {messages?.map(message => (
          <ChatBubble key={message.id} message={message} />
        ))}

        <AnimatePresence>
          {otherUserTyping && <TypingIndicator key="typing" />}
        </AnimatePresence>
      </div>

      {isClosed ? (
        <div className="border-t p-4 text-center text-sm text-muted-foreground bg-muted/40">
          This case has ended. You can no longer reply in this thread.
        </div>
      ) : (
        <ChatInput conversationId={conversationId} otherUserId={otherUserId} />
      )}
    </Card>
  );
}
