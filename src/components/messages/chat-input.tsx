'use client';

import * as React from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SendHorizonal, Image as ImageIcon } from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
} from 'firebase/firestore';

const chatInputSchema = z.object({
  content: z.string().min(1),
});
type ChatInputValues = z.infer<typeof chatInputSchema>;

interface ChatInputProps {
  conversationId: string;
  otherUserId: string | undefined;
}

export function ChatInput({ conversationId, otherUserId }: ChatInputProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const typingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<ChatInputValues>({
    resolver: zodResolver(chatInputSchema),
    defaultValues: { content: '' },
  });

  const setTyping = React.useCallback(
    async (isTyping: boolean) => {
      if (!user || !firestore) return;
      try {
        await updateDoc(doc(firestore, 'conversations', conversationId), {
          [`typing.${user.uid}`]: isTyping,
        });
      } catch {
        // Ignore typing update errors
      }
    },
    [user, firestore, conversationId]
  );

  const handleKeyDown = () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    setTyping(true);
    typingTimerRef.current = setTimeout(() => setTyping(false), 3000);
  };

  React.useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      setTyping(false);
    };
  }, [setTyping]);

  const onSubmit: SubmitHandler<ChatInputValues> = async (data) => {
    if (!user || !firestore) return;

    const messagesCol = collection(firestore, 'conversations', conversationId, 'messages');
    const conversationRef = doc(firestore, 'conversations', conversationId);

    // Clear typing indicator immediately
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    setTyping(false);

    try {
      // Add message
      await addDoc(messagesCol, {
        senderId: user.uid,
        content: data.content,
        createdAt: serverTimestamp(),
        read: false,
      });

      // Update conversation metadata
      const updateData: Record<string, any> = {
        lastMessage: data.content,
        lastMessageAt: serverTimestamp(),
        [`typing.${user.uid}`]: false,
      };
      if (otherUserId) {
        updateData[`unreadCount.${otherUserId}`] = increment(1);
      }
      await updateDoc(conversationRef, updateData);

      form.reset();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="p-3 border-t bg-background">
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2">
        <Button variant="ghost" size="icon" type="button" className="text-muted-foreground flex-shrink-0">
          <ImageIcon className="h-5 w-5" />
        </Button>
        <Input
          {...form.register('content')}
          placeholder="Type a message..."
          autoComplete="off"
          onKeyDown={handleKeyDown}
          className="rounded-full bg-muted border-0 focus-visible:ring-1"
        />
        <Button
          type="submit"
          size="icon"
          disabled={form.formState.isSubmitting}
          className="rounded-full flex-shrink-0"
        >
          <SendHorizonal className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
