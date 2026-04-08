'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Loader2, SendHorizonal, User, X } from 'lucide-react';
import { useUser, useFirestore, errorEmitter } from '@/firebase';
import { chatWithAI } from '@/ai/flows/ai-chat';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { MessageSchema } from '@/ai/flows/ai-chat';
import { useCart } from '@/context/CartContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { ChatProductCard } from '@/lib/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  products?: ChatProductCard[];
  type?: 'text' | 'product_card';
  productData?: ChatProductCard;
}

function ProductCardInChat({ product }: { product: ChatProductCard }) {
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const router = useRouter();

  const handleAddToCart = () => {
    addToCart({
      id: product.id,
      title: product.title,
      price: product.price,
      brand: product.brandId,
      image: product.image,
      sellerId: product.sellerId,
      images: [{ url: product.image, position: 0 }],
    });
  };

  return (
    <div className="border rounded-lg p-2 bg-background shadow-sm">
      {product.image && (
        <div className="relative h-28 w-full rounded-md overflow-hidden bg-muted mb-2">
          <Image src={product.image} alt={product.title} fill className="object-cover" sizes="200px" />
        </div>
      )}
      <p className="font-bold text-[11px] uppercase tracking-wider truncate">{product.brandId}</p>
      <p className="text-xs text-muted-foreground truncate">{product.title}</p>
      <p className="text-sm font-semibold mt-1">{formatPrice(product.price)}</p>
      <div className="flex gap-1.5 mt-2">
        <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleAddToCart}>Add to Cart</Button>
        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => router.push(`/products/${product.id}`)}>View</Button>
      </div>
    </div>
  );
}

const ChatBubble = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === 'user';
  return (
    <div className={cn("flex items-start gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
      )}
      <div className={cn(
        "max-w-xs md:max-w-md rounded-2xl px-4 py-2 text-sm",
        isUser
          ? "bg-primary text-primary-foreground rounded-br-none"
          : "bg-muted rounded-bl-none"
      )}>
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.products && message.products.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {message.products.map((p) => (
              <ProductCardInChat key={p.id} product={p} />
            ))}
          </div>
        )}
        {message.type === 'product_card' && message.productData && (
          <ProductCardInChat product={message.productData} />
        )}
      </div>
      {isUser && (
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
};

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);

  const { user } = useUser();
  const firestore = useFirestore();

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const createNewChat = useCallback(async (firstMessage: string) => {
    if (!user || !firestore) return null;
    try {
      const chatData = {
        userId: user.uid,
        startedAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        topic: firstMessage,
        status: 'open',
      };
      const chatRef = await addDoc(collection(firestore, 'support_chats'), chatData);
      setChatId(chatRef.id);
      return chatRef.id;
    } catch (error) {
      console.error("Error creating new chat:", error);
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'support_chats', operation: 'create' }));
      return null;
    }
  }, [user, firestore]);

  const saveMessage = useCallback(async (
    chatId: string,
    message: z.infer<typeof MessageSchema>,
    extra?: { products?: ChatProductCard[]; type?: string; productData?: ChatProductCard }
  ) => {
    if (!firestore) return;
    try {
      await addDoc(collection(firestore, 'support_chats', chatId, 'messages'), {
        ...message,
        ...extra,
        timestamp: serverTimestamp(),
      });
      await setDoc(doc(firestore, 'support_chats', chatId), { lastMessageAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error("Error saving message:", error);
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `support_chats/${chatId}/messages`, operation: 'create' }));
    }
  }, [firestore]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    let currentChatId = chatId;
    if (!currentChatId) {
      currentChatId = await createNewChat(input);
    }

    if (currentChatId) {
      await saveMessage(currentChatId, { role: 'user', content: input });

      const history = messages.map(({ role, content }) => ({ role, content }));
      history.push({ role: 'user', content: input });

      try {
        const aiResponse = await chatWithAI({ history, message: input });
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'model',
          content: aiResponse.response,
          products: aiResponse.products,
        };
        setMessages(prev => [...prev, aiMessage]);
        await saveMessage(currentChatId, { role: 'model', content: aiResponse.response }, {
          products: aiResponse.products,
        });
      } catch (error) {
        console.error("AI chat error:", error);
        const errorMessage: ChatMessage = { id: `err-${Date.now()}`, role: 'model', content: "I'm having trouble connecting right now. Please try again later." };
        setMessages(prev => [...prev, errorMessage]);
      }
    }

    setIsLoading(false);
  };

  return (
    <>
      <Button
        className="fixed bottom-4 right-4 h-16 w-16 rounded-full shadow-lg"
        size="icon"
        onClick={() => setIsOpen(true)}
      >
        <Bot className="h-8 w-8" />
      </Button>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-4 border-b text-left">
            <SheetTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              MarigoAI
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 h-7 w-7"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-5 w-5 text-muted-foreground" />
              <span className="sr-only">Close</span>
            </Button>
          </SheetHeader>
          <ScrollArea className="flex-1" ref={scrollAreaRef}>
            <div className="p-4 space-y-4">
              <ChatBubble message={{ id: 'initial', role: 'model', content: "Hi! How can I help you today?" }} />
              {messages.map((msg) => <ChatBubble key={msg.id} message={msg} />)}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-none px-4 py-3">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="p-4 border-t bg-background">
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                autoComplete="off"
                disabled={isLoading}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                <SendHorizonal className="h-5 w-5" />
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
