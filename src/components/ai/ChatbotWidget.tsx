'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, SendHorizonal, User, X, ArrowRight } from 'lucide-react';
import { useUser, useFirestore, errorEmitter } from '@/firebase';
import { chatWithAI } from '@/ai/flows/ai-chat';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { MessageSchema, type ChatLink } from '@/ai/flows/ai-chat';
import { useCart } from '@/context/CartContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useTranslation } from '@/context/LanguageContext';
import { useShoppingPreference } from '@/hooks/use-shopping-preference';
import { useVisualViewport } from '@/hooks/use-visual-viewport';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { ChatProductCard } from '@/lib/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  products?: ChatProductCard[];
  links?: ChatLink[];
  type?: 'text' | 'product_card';
  productData?: ChatProductCard;
}

/**
 * The Marigo app icon, standing in for the generic robot glyph everywhere the
 * assistant identifies itself. Decorative by default — every placement sits
 * next to the "MarigoAI" label or a message that already names the sender.
 */
function MarigoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/app-icon.png"
      alt=""
      width={64}
      height={64}
      className={cn('rounded-full object-cover', className)}
    />
  );
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

/**
 * A destination the assistant suggested — "Sign up", "All Zara", "Start selling".
 * Rendered as a button rather than an inline URL so the answer stays readable
 * and the tap target is thumb-sized.
 */
function ChatLinkButtons({ links, onNavigate }: { links: ChatLink[]; onNavigate: () => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {links.map((link) => (
        <Button
          key={link.href}
          asChild
          size="sm"
          variant="outline"
          className="h-7 gap-1 rounded-full bg-background px-3 text-xs font-medium"
        >
          <Link href={link.href} onClick={onNavigate}>
            {link.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      ))}
    </div>
  );
}

const ChatBubble = ({ message, onNavigate }: { message: ChatMessage; onNavigate: () => void }) => {
  const isUser = message.role === 'user';
  return (
    <div className={cn("flex items-start gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && <MarigoMark className="h-8 w-8 flex-shrink-0" />}
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
        {message.links && message.links.length > 0 && (
          <ChatLinkButtons links={message.links} onNavigate={onNavigate} />
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
  const { locale } = useTranslation();
  const shoppingPreference = useShoppingPreference();

  // Only measured while the panel is open — see the hook for why the CSS
  // height alone leaves the header stranded off-screen on iOS.
  const viewport = useVisualViewport(isOpen);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

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

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const question = input.trim();
    if (!question || isLoading) return;

    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: question };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const history = messages.map(({ role, content }) => ({ role, content }));
    history.push({ role: 'user', content: question });

    // Transcripts are only kept for signed-in users — `support_chats` requires
    // auth in firestore.rules, and an admin has nobody to reply to otherwise.
    // Persistence is deliberately fire-and-forget: answering must never depend
    // on it. It used to, which meant a signed-out visitor's message vanished
    // with no reply at all.
    let currentChatId = chatId;
    if (user) {
      if (!currentChatId) currentChatId = await createNewChat(question);
      if (currentChatId) void saveMessage(currentChatId, { role: 'user', content: question });
    }

    try {
      const aiResponse = await chatWithAI({
        history,
        message: question,
        isSignedIn: !!user,
        gender: shoppingPreference,
        locale,
      });
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'model',
        content: aiResponse.response,
        products: aiResponse.products,
        links: aiResponse.links,
      };
      setMessages(prev => [...prev, aiMessage]);

      if (currentChatId) {
        void saveMessage(currentChatId, { role: 'model', content: aiResponse.response }, {
          products: aiResponse.products,
        });
      }
    } catch (error) {
      console.error("AI chat error:", error);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'model',
        content: locale === 'sq'
          ? 'Më vjen keq, nuk po arrij të lidhem për momentin. Provoni përsëri pas pak.'
          : "I'm having trouble connecting right now. Please try again later.",
        links: [{ label: locale === 'sq' ? 'Qendra e Ndihmës' : 'Help Centre', href: '/help' }],
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('open-chatbot', handler);
    return () => window.removeEventListener('open-chatbot', handler);
  }, []);

  // The opening line sets the language expectation; after that the assistant
  // mirrors whatever the visitor writes, regardless of the site locale.
  const greeting = locale === 'sq'
    ? 'Përshëndetje! Si mund t’ju ndihmoj sot?'
    : 'Hi! How can I help you today?';

  return (
    <>
      <Button
        aria-label="Open MarigoAI"
        className="fixed bottom-4 right-4 h-16 w-16 overflow-hidden rounded-full p-0 shadow-lg hidden md:inline-flex"
        size="icon"
        onClick={() => setIsOpen(true)}
      >
        {/* The mark fills the button rather than sitting inside it — the icon's
            own purple would otherwise disappear against the primary fill. */}
        <MarigoMark className="h-full w-full" />
      </Button>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        {/* hideClose: SheetContent renders its own X at right-4 top-4, which
            collided with the one below at right-3 top-3 and read as a doubled
            icon. Keep one, wrapped in SheetClose so Radix still owns closing. */}
        <SheetContent
          side="right"
          hideClose
          className="w-full sm:max-w-md p-0 flex flex-col"
          // `sheetVariants` pins this with `inset-y-0 h-full`, which is measured
          // against the layout viewport — a viewport iOS does NOT shrink for the
          // keyboard. Safari then scrolls the panel up to reveal the focused
          // input and the header disappears off the top. Pinning to the visual
          // viewport instead keeps the header, the transcript and the composer
          // all on screen while typing. Inline styles beat the utility classes.
          style={
            viewport
              ? { top: viewport.offsetTop, height: viewport.height, bottom: 'auto' }
              : undefined
          }
        >
          <SheetHeader className="p-4 border-b text-left shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <MarigoMark className="h-6 w-6" />
              MarigoAI
            </SheetTitle>
            <SheetDescription className="sr-only">
              Chat with MarigoAI for help with orders, sizing, and finding items.
            </SheetDescription>
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2.5 right-2.5 h-9 w-9"
              >
                <X className="h-5 w-5 text-muted-foreground" />
                <span className="sr-only">Close</span>
              </Button>
            </SheetClose>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1" ref={scrollAreaRef}>
            <div className="p-4 space-y-4">
              <ChatBubble
                message={{ id: 'initial', role: 'model', content: greeting }}
                onNavigate={() => setIsOpen(false)}
              />
              {messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} onNavigate={() => setIsOpen(false)} />
              ))}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <MarigoMark className="h-8 w-8 flex-shrink-0" />
                  <div className="bg-muted rounded-2xl rounded-bl-none px-4 py-3">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="shrink-0 border-t bg-background p-4">
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <Input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                // Implicit form submission on Enter is unreliable inside a
                // Radix dialog, which handles keydown at the root. Send
                // explicitly — pressing Enter is how people expect a chat box
                // to work, and falling back to only the button is a papercut.
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={locale === 'sq' ? 'Bëni një pyetje…' : 'Ask a question...'}
                autoComplete="off"
                // Deliberately NOT disabled while loading: on iOS, disabling the
                // focused input dismisses the keyboard, so the panel resizes
                // twice per message and the view jumps.
                aria-busy={isLoading}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                <SendHorizonal className="h-5 w-5" />
                <span className="sr-only">{locale === 'sq' ? 'Dërgo' : 'Send'}</span>
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
