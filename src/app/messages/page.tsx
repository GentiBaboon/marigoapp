'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import type { FirestoreConversation, FirestoreUser } from '@/lib/types';
import { ConversationListItem, ConversationSkeleton } from '@/components/messages/conversation-list-item';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ChatRulesDialog } from '@/components/messages/chat-rules-dialog';
import { useToast } from '@/hooks/use-toast';

function EmptyState() {
    return (
        <div className="text-center py-20 flex flex-col items-center h-full justify-center">
            <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground" />
            <h2 className="mt-6 text-xl font-semibold">No messages yet</h2>
            <p className="mt-2 text-muted-foreground max-w-xs">
                When you contact a seller, your conversation will appear here.
            </p>
            <Button asChild className="mt-6">
                <Link href="/home">Start Shopping</Link>
            </Button>
        </div>
    )
}

export default function MessagesPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isAccepting, setIsAccepting] = React.useState(false);

    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, 'users', user.uid);
    }, [user, firestore]);

    const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<FirestoreUser>(userDocRef);
    
    const showRules = !isUserLoading && !isUserProfileLoading && !!userProfile && !userProfile.has_accepted_chat_rules;

    const handleAcceptRules = async () => {
        if (!userDocRef) return;
        setIsAccepting(true);
        try {
            await updateDoc(userDocRef, { has_accepted_chat_rules: true });
        } catch (error) {
            console.error("Failed to update chat rules acceptance:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'update',
                requestResourceData: { has_accepted_chat_rules: true },
            }));
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not save your preference. Please try again.',
            });
        } finally {
            setIsAccepting(false);
        }
    };

    const conversationsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'conversations'), 
            where('participants', 'array-contains', user.uid),
            orderBy('lastMessageAt', 'desc')
        );
    }, [user, firestore]);

    const { data: conversations, isLoading: areConversationsLoading } = useCollection<FirestoreConversation>(conversationsQuery);
    
    const isLoading = isUserLoading || areConversationsLoading || isUserProfileLoading;

    if (!user && !isUserLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>My Messages</CardTitle>
            <CardDescription>
              Please sign in to view your messages.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/auth">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

    return (
        <>
            {user && (
                <ChatRulesDialog 
                    isOpen={showRules} 
                    onAccept={handleAcceptRules}
                    isAccepting={isAccepting}
                />
            )}
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold">Messages</CardTitle>
                </CardHeader>
                <CardContent className="p-0 h-[calc(100%-4rem)] overflow-y-auto">
                    {isLoading ? (
                        <div className="space-y-2 p-4">
                            <ConversationSkeleton />
                            <ConversationSkeleton />
                            <ConversationSkeleton />
                        </div>
                    ) : conversations && conversations.length > 0 ? (
                        <div className="border-t">
                            {conversations.map(convo => (
                                <ConversationListItem key={convo.id} conversation={convo} currentUserId={user.uid} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState />
                    )}
                </CardContent>
            </Card>
        </>
    )
}
