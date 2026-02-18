'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Loader2, SendHorizonal, User, X } from 'lucide-react';
import { useUser, useFirestore, errorEmitter } from '@/firebase';
import { useI18n } from '@/hooks/use-i18n';
import { chatWithAI, type MessageSchema } from '@/ai/flows/ai-chat';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';

type Message = z.infer<typeof MessageSchema> & { id: string };

const ChatBubble = ({ message }: { message: Message }) => {
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
                <p>{message.content}</p>
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
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatId, setChatId] = useState<string | null>(null);

    const { user } = useUser();
    const firestore = useFirestore();
    const { t, locale } = useI18n();

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
    
    const saveMessage = useCallback(async (chatId: string, message: z.infer<typeof MessageSchema>) => {
        if (!firestore) return;
        try {
            await addDoc(collection(firestore, 'support_chats', chatId, 'messages'), { ...message, timestamp: serverTimestamp() });
            await setDoc(doc(firestore, 'support_chats', chatId), { lastMessageAt: serverTimestamp() }, { merge: true });
        } catch (error) {
            console.error("Error saving message:", error);
             errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `support_chats/${chatId}/messages`, operation: 'create' }));
        }
    }, [firestore]);


    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage: Message = { id: `user-${Date.now()}`, role: 'user', content: input };
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
                const aiResponse = await chatWithAI({ history, message: input, language: t('Auth.signInTitle') /* Using a key to detect language */ });
                const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'model', content: aiResponse.response };
                setMessages(prev => [...prev, aiMessage]);
                await saveMessage(currentChatId, { role: 'model', content: aiResponse.response });
            } catch (error) {
                console.error("AI chat error:", error);
                const errorMessage: Message = { id: `err-${Date.now()}`, role: 'model', content: "I'm having trouble connecting right now. Please try again later." };
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
                            AI Support Chat
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
                           <ChatBubble message={{id: 'initial', role: 'model', content: "Hi! How can I help you today?"}}/>
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
