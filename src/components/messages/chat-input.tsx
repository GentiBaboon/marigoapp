'use client';

import * as React from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SendHorizonal, Paperclip } from 'lucide-react';
import { useUser, useFirestore, errorEmitter } from '@/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';

const chatInputSchema = z.object({
  content: z.string().min(1, { message: "Message cannot be empty." }),
});

type ChatInputValues = z.infer<typeof chatInputSchema>;

interface ChatInputProps {
  conversationId: string;
}

export function ChatInput({ conversationId }: ChatInputProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const form = useForm<ChatInputValues>({
    resolver: zodResolver(chatInputSchema),
    defaultValues: { content: '' },
  });

  const onSubmit: SubmitHandler<ChatInputValues> = async (data) => {
    if (!user || !firestore) return;

    const newMessage = {
      senderId: user.uid,
      content: data.content,
      createdAt: serverTimestamp(),
      read: false,
    };
    
    const messagesCollection = collection(firestore, 'conversations', conversationId, 'messages');

    try {
        await addDoc(messagesCollection, newMessage);
        form.reset();
    } catch (error) {
        console.error("Error sending message:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: messagesCollection.path,
            operation: 'create',
            requestResourceData: newMessage,
        }));
    }
  };

  return (
    <div className="p-2 border-t">
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2">
        <Button variant="ghost" size="icon" type="button">
            <Paperclip className="h-5 w-5" />
        </Button>
        <Input 
          {...form.register('content')} 
          placeholder="Type a message..." 
          autoComplete="off"
        />
        <Button type="submit" size="icon" disabled={form.formState.isSubmitting}>
          <SendHorizonal className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
