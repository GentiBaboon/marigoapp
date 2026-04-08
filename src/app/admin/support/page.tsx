'use client';

import * as React from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  onSnapshot,
  doc,
  updateDoc,
  getDocs,
  where,
} from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, MessageSquare, ArrowLeft, CheckCheck, ShoppingBag, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { FirestoreProduct, ChatProductCard } from '@/lib/types';

interface SupportChat {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  status: 'open' | 'closed';
  lastMessage: string;
  lastMessageAt: any;
  unreadByAdmin: number;
}

interface SupportMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: any;
  isAdmin: boolean;
  type?: 'text' | 'product_card';
  productData?: ChatProductCard;
}

export default function AdminSupportPage() {
  const firestore = useFirestore();
  const { user: adminUser } = useUser();
  const [selectedChat, setSelectedChat] = React.useState<SupportChat | null>(null);
  const [messages, setMessages] = React.useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [productSearchOpen, setProductSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<FirestoreProduct[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  // Fetch all support chats
  const chatsQuery = useMemoFirebase(
    () => query(collection(firestore, 'support_chats'), orderBy('lastMessageAt', 'desc'), limit(50)),
    [firestore]
  );
  const { data: chats, isLoading: chatsLoading } = useCollection<SupportChat>(chatsQuery);

  // Listen to messages for selected chat
  React.useEffect(() => {
    if (!selectedChat || !firestore) return;

    const messagesRef = collection(firestore, 'support_chats', selectedChat.id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(100));

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupportMessage));
      setMessages(msgs);
    });

    // Mark as read by admin
    if (selectedChat.unreadByAdmin > 0) {
      updateDoc(doc(firestore, 'support_chats', selectedChat.id), { unreadByAdmin: 0 });
    }

    return () => unsub();
  }, [selectedChat, firestore]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedChat || !firestore || !adminUser) return;
    setIsSending(true);

    try {
      const messagesRef = collection(firestore, 'support_chats', selectedChat.id, 'messages');
      await addDoc(messagesRef, {
        senderId: adminUser.uid,
        senderName: adminUser.displayName || 'Admin',
        content: newMessage.trim(),
        createdAt: serverTimestamp(),
        isAdmin: true,
      });

      await updateDoc(doc(firestore, 'support_chats', selectedChat.id), {
        lastMessage: newMessage.trim(),
        lastMessageAt: serverTimestamp(),
      });

      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseChat = async () => {
    if (!selectedChat || !firestore) return;
    await updateDoc(doc(firestore, 'support_chats', selectedChat.id), { status: 'closed' });
  };

  const handleReopenChat = async () => {
    if (!selectedChat || !firestore) return;
    await updateDoc(doc(firestore, 'support_chats', selectedChat.id), { status: 'open' });
  };

  const handleProductSearch = async () => {
    if (!searchQuery.trim() || !firestore) return;
    setIsSearching(true);
    try {
      const q = query(collection(firestore, 'products'), where('status', '==', 'active'), limit(20));
      const snap = await getDocs(q);
      const results = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as FirestoreProduct))
        .filter(p =>
          p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.brandId?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      setSearchResults(results);
    } catch (err) {
      console.error('Product search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendProduct = async (product: FirestoreProduct) => {
    if (!selectedChat || !firestore || !adminUser) return;
    const messagesRef = collection(firestore, 'support_chats', selectedChat.id, 'messages');
    await addDoc(messagesRef, {
      senderId: adminUser.uid,
      senderName: adminUser.displayName || 'Support',
      content: `Check out this product: ${product.title}`,
      createdAt: serverTimestamp(),
      isAdmin: true,
      type: 'product_card',
      productData: {
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.images?.[0]?.url || '',
        brandId: product.brandId,
        sellerId: product.sellerId,
      },
    });
    await updateDoc(doc(firestore, 'support_chats', selectedChat.id), {
      lastMessage: `Shared product: ${product.title}`,
      lastMessageAt: serverTimestamp(),
    });
    setProductSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const openChats = chats?.filter(c => c.status === 'open') || [];
  const closedChats = chats?.filter(c => c.status === 'closed') || [];

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4">
      {/* Chat List */}
      <Card className="w-80 shrink-0 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Support Chats
          </CardTitle>
          <CardDescription>
            {openChats.length} open, {closedChats.length} closed
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full">
            <div className="px-3 pb-3 space-y-1">
              {chatsLoading ? (
                <p className="text-sm text-muted-foreground p-4 text-center">Loading...</p>
              ) : chats && chats.length > 0 ? (
                chats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={cn(
                      'w-full text-left rounded-lg p-3 transition-colors',
                      selectedChat?.id === chat.id
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm truncate">{chat.userName}</span>
                      <Badge
                        variant={chat.status === 'open' ? 'default' : 'secondary'}
                        className="text-[10px] shrink-0"
                      >
                        {chat.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{chat.subject}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.lastMessage}</p>
                    {chat.unreadByAdmin > 0 && (
                      <Badge variant="destructive" className="mt-1 text-[10px]">
                        {chat.unreadByAdmin} new
                      </Badge>
                    )}
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground p-4 text-center">No support chats yet.</p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Window */}
      <Card className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden h-8 w-8"
                    onClick={() => setSelectedChat(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{selectedChat.userName?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{selectedChat.userName}</CardTitle>
                    <CardDescription className="text-xs">{selectedChat.subject}</CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  {selectedChat.status === 'open' ? (
                    <Button variant="outline" size="sm" onClick={handleCloseChat}>
                      <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                      Close
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={handleReopenChat}>
                      Reopen
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full p-4">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn('flex', msg.isAdmin ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[70%] rounded-2xl px-4 py-2.5',
                          msg.isAdmin
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-muted rounded-bl-sm'
                        )}
                      >
                        <p className="text-sm">{msg.content}</p>
                        {msg.type === 'product_card' && msg.productData && (
                          <div className="max-w-[280px] border rounded-lg p-3 space-y-2 bg-background shadow-sm mt-2">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Product Recommendation</p>
                            <div className="flex gap-3 items-center">
                              {msg.productData.image && (
                                <div className="relative h-14 w-14 rounded bg-muted overflow-hidden flex-shrink-0">
                                  <Image src={msg.productData.image} alt="" fill className="object-cover" sizes="56px" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-bold text-xs uppercase text-foreground">{msg.productData.brandId}</p>
                                <p className="text-xs truncate text-foreground">{msg.productData.title}</p>
                                <p className="text-sm font-semibold text-foreground">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(msg.productData.price)}</p>
                              </div>
                            </div>
                          </div>
                        )}
                        <p
                          className={cn(
                            'text-[10px] mt-1',
                            msg.isAdmin ? 'text-primary-foreground/60' : 'text-muted-foreground'
                          )}
                        >
                          {msg.createdAt?.toDate
                            ? format(msg.createdAt.toDate(), 'HH:mm')
                            : '...'}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </CardContent>

            <div className="border-t p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a reply..."
                  disabled={isSending}
                />
                <Button type="submit" disabled={isSending || !newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setProductSearchOpen(true)} title="Share Product" type="button">
                  <ShoppingBag className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Select a conversation</p>
              <p className="text-sm">Choose a support chat from the left to start responding.</p>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={productSearchOpen} onOpenChange={setProductSearchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share a Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by name or brand..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleProductSearch()}
              />
              <Button onClick={handleProductSearch} disabled={isSearching} size="icon">
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {searchResults.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => handleSendProduct(p)}>
                  <div className="relative h-12 w-12 rounded bg-muted overflow-hidden flex-shrink-0">
                    {p.images?.[0]?.url && <Image src={p.images[0].url} alt="" fill className="object-cover" sizes="48px" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs uppercase">{p.brandId}</p>
                    <p className="text-sm truncate">{p.title}</p>
                    <p className="text-sm font-semibold">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(p.price)}</p>
                  </div>
                  <Button size="sm" variant="outline">Send</Button>
                </div>
              ))}
              {searchResults.length === 0 && searchQuery && !isSearching && (
                <p className="text-center text-sm text-muted-foreground py-4">No products found. Try different keywords.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
