'use client';

import * as React from 'react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import type { FirestoreConversation, FirestoreMessage } from '@/lib/types';
import { ChatHeader } from '@/components/messages/chat-header';
import { ChatBubble } from '@/components/messages/chat-bubble';
import { ChatInput } from '@/components/messages/chat-input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

function ChatSkeleton() {
    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-6 w-24" />
            </div>
            <div className="flex justify-end">
                <Skeleton className="h-12 w-48 rounded-lg" />
            </div>
            <div className="flex justify-start">
                <Skeleton className="h-16 w-64 rounded-lg" />
            </div>
            <div className="flex justify-end">
                <Skeleton className="h-8 w-32 rounded-lg" />
            </div>
        </div>
    )
}

export default function ChatPage({ params }: { params: { conversationId: string } }) {
    const { conversationId } = params;
    const { user } = useUser();
    const firestore = useFirestore();
    const bottomRef = React.useRef<HTMLDivElement>(null);

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

    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const otherUser = conversation?.participantDetails.find(p => p.userId !== user?.uid);

    if (isConversationLoading) {
        return <Card className="h-full flex flex-col"><ChatSkeleton /></Card>
    }

    return (
        <Card className="h-full flex flex-col">
            {otherUser && conversation && (
                <ChatHeader 
                    user={otherUser} 
                    product={{ id: conversation.productId, title: conversation.productTitle, image: conversation.productImage }} 
                />
            )}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages?.map(message => (
                    <ChatBubble key={message.id} message={message} />
                ))}
                <div ref={bottomRef} />
            </div>
            <ChatInput conversationId={conversationId} />
        </Card>
    )
}
