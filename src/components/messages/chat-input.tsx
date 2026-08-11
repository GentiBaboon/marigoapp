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

  const content = form.watch('content');
  const canSend = !!content?.trim() && !form.formState.isSubmitting;

  return (
    // The extra bottom padding clears the iPhone home indicator; it collapses
    // to the base p-3 on devices that report no inset.
    <div className="border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label="Attach an image"
          className="h-11 w-11 flex-shrink-0 text-muted-foreground md:h-10 md:w-10"
        >
          <ImageIcon className="h-5 w-5" />
        </Button>
        <Input
          {...form.register('content')}
          placeholder="Type a message..."
          autoComplete="off"
          // Turns the phone keyboard's return key into "Send", and stops the
          // aggressive auto-capitalising/correcting some keyboards default to.
          enterKeyHint="send"
          autoCapitalize="sentences"
          onKeyDown={handleKeyDown}
          className="h-11 rounded-full border-0 bg-muted focus-visible:ring-1 md:h-10"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send message"
          disabled={!canSend}
          className="h-11 w-11 flex-shrink-0 rounded-full md:h-10 md:w-10"
        >
          <SendHorizonal className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
