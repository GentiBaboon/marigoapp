'use client';

import * as React from 'react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, updateDoc, writeBatch, getDocs, where } from 'firebase/firestore';
import type { FirestoreConversation, FirestoreMessage } from '@/lib/types';
import { ChatHeader } from '@/components/messages/chat-header';
import { ChatBubble } from '@/components/messages/chat-bubble';
import { ChatInput } from '@/components/messages/chat-input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';

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
  const bottomRef = React.useRef<HTMLDivElement>(null);
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

  const otherUser = conversation?.participantDetails.find(p => p.userId !== user?.uid);
  const otherUserId = otherUser?.userId;

  // Detect if the other user is typing
  const otherUserTyping = otherUserId
    ? (conversation as any)?.typing?.[otherUserId] === true
    : false;

  // Mark unread messages as read when conversation opens
  React.useEffect(() => {
    if (!user || !firestore || !messages || hasMarkedRead.current) return;
    hasMarkedRead.current = true;

    const unreadFromOther = messages.filter(m => m.senderId !== user.uid && !m.read);
    if (unreadFromOther.length === 0) return;

    const batch = writeBatch(firestore);

    // Mark individual messages as read
    unreadFromOther.forEach(m => {
      const msgRef = doc(firestore, 'conversations', conversationId, 'messages', m.id);
      batch.update(msgRef, { read: true });
    });

    // Reset unread count for current user
    if (conversationRef) {
      batch.update(conversationRef, { [`unreadCount.${user.uid}`]: 0 });
    }

    batch.commit().catch(() => {/* ignore */});
  }, [messages, user, firestore, conversationId, conversationRef]);

  // Scroll to bottom on new messages
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isConversationLoading) {
    return <Card className="h-full flex flex-col"><ChatSkeleton /></Card>;
  }

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      {otherUser && conversation && (
        <ChatHeader
          user={otherUser}
          product={{ id: conversation.productId, title: conversation.productTitle, image: conversation.productImage }}
          isTyping={otherUserTyping}
        />
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages?.map(message => (
          <ChatBubble key={message.id} message={message} />
        ))}

        <AnimatePresence>
          {otherUserTyping && <TypingIndicator key="typing" />}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      <ChatInput conversationId={conversationId} otherUserId={otherUserId} />
    </Card>
  );
}
