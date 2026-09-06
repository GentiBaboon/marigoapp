'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { format, formatDistanceToNow, isToday } from 'date-fns';
import { ArrowLeft, Bot, MessageSquare, Search, Sparkles, UserRound, Users } from 'lucide-react';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Money } from '@/components/admin/money';
import { StatCard } from '@/components/admin/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { fetchMap } from '@/lib/fetch-map';
import { toDate, type ChatProductCard, type FirestoreUser } from '@/lib/types';
import AssistantChatsLoading from './loading';

/** Newest chats shown. A transcript is a handful of turns, so this stays cheap. */
const CHATS_LIMIT = 100;

/**
 * One `support_chats` document. The AI widget writes `userId` / `topic` /
 * `status` / `startedAt` / `lastMessageAt` and nothing else — no name, no
 * subject, no last-message preview. Those are joined or derived here. The
 * optional legacy fields belong to the earlier human-support shape and are
 * read when present so old threads still render.
 */
interface AssistantChat {
  id: string;
  userId: string;
  topic?: string;
  status?: string;
  startedAt?: unknown;
  lastMessageAt?: unknown;
  /** Legacy human-support fields. */
  userName?: string;
  subject?: string;
  lastMessage?: string;
}

/**
 * One message. The widget stores `{ role, content, timestamp, products? }`;
 * the earlier support shape stored `{ senderId, senderName, isAdmin, content,
 * createdAt }`. Both are rendered — the difference is who wrote it.
 */
interface AssistantMessage {
  id: string;
  role?: 'user' | 'model';
  content: string;
  timestamp?: unknown;
  createdAt?: unknown;
  isAdmin?: boolean;
  senderName?: string;
  products?: ChatProductCard[];
  type?: 'text' | 'product_card';
  productData?: ChatProductCard;
}

function messageDate(msg: AssistantMessage): Date | null {
  return toDate((msg.timestamp ?? msg.createdAt) as any);
}

function fromVisitor(msg: AssistantMessage): boolean {
  return msg.role === 'user' || (msg.role == null && !msg.isAdmin);
}

function displayName(user: FirestoreUser | undefined, chat: AssistantChat): string {
  return user?.name || user?.displayName || chat.userName || user?.email || `${chat.userId.slice(0, 8)}…`;
}

function ProductChip({ product }: { product: ChatProductCard }) {
  return (
    <Link
      href={`/admin/products/${product.id}`}
      className="flex items-center gap-2 rounded-md border bg-background p-1.5 pr-3 text-foreground hover:bg-muted"
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
        {product.image && <Image src={product.image} alt="" fill className="object-cover" sizes="40px" />}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-wider">{product.brandId}</p>
        <p className="truncate text-xs">{product.title}</p>
        <p className="text-xs font-semibold">
          <Money eur={product.price} />
        </p>
      </div>
    </Link>
  );
}

export default function AdminAssistantChatsPage() {
  const firestore = useFirestore();
  const [users, setUsers] = React.useState<Map<string, FirestoreUser>>(new Map());
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<AssistantMessage[] | null>(null);
  const [search, setSearch] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Live: an operator can watch a chat as it happens.
  const chatsQuery = useMemoFirebase(
    () => query(collection(firestore, 'support_chats'), orderBy('lastMessageAt', 'desc'), limit(CHATS_LIMIT)),
    [firestore],
  );
  const { data: chats, isLoading } = useCollection<AssistantChat>(chatsQuery);

  // Names are not on the chat document, so join them — once per distinct
  // shopper, and only for ids not already resolved.
  React.useEffect(() => {
    if (!chats) return;
    const missing = chats.map((c) => c.userId).filter((id) => id && !users.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    fetchMap(missing, async (id) => {
      const snap = await getDoc(doc(firestore, 'users', id));
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as FirestoreUser) : null;
    }).then((found) => {
      if (cancelled || found.size === 0) return;
      setUsers((prev) => new Map([...prev, ...found]));
    });
    return () => {
      cancelled = true;
    };
    // `users` is deliberately not a dependency: it only grows, and re-running
    // on every growth would refetch nothing but still churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, firestore]);

  // Transcript for the selected chat. No `orderBy`: the widget stamps
  // `timestamp` and the legacy shape stamped `createdAt`, and Firestore drops
  // any document missing the sort field — which is exactly how the previous
  // version of this page showed every assistant chat as empty. Sorted here.
  React.useEffect(() => {
    if (!selectedId) {
      setMessages(null);
      return;
    }
    setMessages(null);
    const unsub = onSnapshot(collection(firestore, 'support_chats', selectedId, 'messages'), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AssistantMessage));
      rows.sort((a, b) => (messageDate(a)?.getTime() ?? 0) - (messageDate(b)?.getTime() ?? 0));
      setMessages(rows);
    });
    return () => unsub();
  }, [selectedId, firestore]);

  // Scroll the transcript's own viewport, not the document: `scrollIntoView`
  // walks every scrollable ancestor and yanked the whole admin page down to
  // the footer each time a chat was opened.
  React.useEffect(() => {
    const viewport = messagesEndRef.current?.closest('[data-radix-scroll-area-viewport]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  const filtered = React.useMemo(() => {
    if (!chats) return [];
    const needle = search.trim().toLowerCase();
    if (!needle) return chats;
    return chats.filter((chat) => {
      const user = users.get(chat.userId);
      return [displayName(user, chat), user?.email, chat.topic, chat.subject]
        .some((v) => v?.toLowerCase().includes(needle));
    });
  }, [chats, users, search]);

  const selected = chats?.find((c) => c.id === selectedId) ?? null;
  const selectedUser = selected ? users.get(selected.userId) : undefined;

  const stats = React.useMemo(() => {
    const all = chats ?? [];
    const today = all.filter((c) => {
      const d = toDate((c.lastMessageAt ?? c.startedAt) as any);
      return d ? isToday(d) : false;
    }).length;
    return { total: all.length, today, people: new Set(all.map((c) => c.userId)).size };
  }, [chats]);

  if (isLoading && !chats) return <AssistantChatsLoading />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Assistant Chats</h1>
          <p className="text-muted-foreground">
            What shoppers asked Marigo, the AI assistant, and what she answered. Read-only — replies typed here
            would reach nobody, since the widget does not listen for them.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Chats"
          value={stats.total}
          icon={<Bot className="h-4 w-4 text-muted-foreground" />}
          description={stats.total >= CHATS_LIMIT ? `Newest ${CHATS_LIMIT} shown` : 'Signed-in shoppers only'}
        />
        <StatCard
          title="Active today"
          value={stats.today}
          icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
          description="With a message today"
        />
        <StatCard
          title="Shoppers"
          value={stats.people}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          description="Distinct accounts"
        />
      </div>

      <div className="flex flex-col gap-4 lg:h-[calc(100vh-22rem)] lg:min-h-[480px] lg:flex-row">
        <Card className="flex max-h-[50vh] shrink-0 flex-col lg:max-h-none lg:w-80">
          <CardHeader className="space-y-3 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Conversations
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email or topic"
                className="h-9 pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="space-y-1 px-3 pb-3">
                {filtered.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    {chats && chats.length > 0 ? 'Nothing matches that search.' : 'No assistant chats yet.'}
                  </p>
                ) : (
                  filtered.map((chat) => {
                    const user = users.get(chat.userId);
                    const when = toDate((chat.lastMessageAt ?? chat.startedAt) as any);
                    return (
                      <button
                        key={chat.id}
                        type="button"
                        onClick={() => setSelectedId(chat.id)}
                        className={cn(
                          'w-full rounded-lg p-3 text-left transition-colors',
                          selectedId === chat.id ? 'border border-primary/20 bg-primary/10' : 'hover:bg-muted',
                        )}
                      >
                        <div className="mb-0.5 flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{displayName(user, chat)}</span>
                          {when && (
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {formatDistanceToNow(when, { addSuffix: true })}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {chat.topic || chat.subject || chat.lastMessage || 'No topic recorded'}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="flex min-h-[480px] flex-1 flex-col">
          {selected ? (
            <>
              <CardHeader className="border-b pb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    {selectedUser?.photoURL && <AvatarImage src={selectedUser.photoURL} alt="" />}
                    <AvatarFallback>{displayName(selectedUser, selected).charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-base">{displayName(selectedUser, selected)}</CardTitle>
                    <CardDescription className="truncate text-xs">
                      {selectedUser?.email || selected.userId}
                      {(() => {
                        const started = toDate(selected.startedAt as any);
                        return started ? ` · started ${format(started, 'd MMM yyyy, HH:mm')}` : '';
                      })()}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="shrink-0 gap-1">
                    <Bot className="h-3 w-3" />
                    AI assistant
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-4">
                  {messages === null ? (
                    <p className="text-center text-sm text-muted-foreground">Loading transcript…</p>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground">This chat has no saved messages.</p>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg) => {
                        const visitor = fromVisitor(msg);
                        const when = messageDate(msg);
                        const author = visitor
                          ? displayName(selectedUser, selected)
                          : msg.role === 'model'
                            ? 'Marigo'
                            : msg.senderName || 'Support';
                        const cards = [
                          ...(msg.products ?? []),
                          ...(msg.type === 'product_card' && msg.productData ? [msg.productData] : []),
                        ];
                        return (
                          <div key={msg.id} className={cn('flex gap-2', visitor ? 'justify-start' : 'justify-end')}>
                            {visitor && (
                              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                                <UserRound className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div
                              className={cn(
                                'max-w-[75%] rounded-2xl px-4 py-2.5',
                                visitor ? 'rounded-bl-sm bg-muted' : 'rounded-br-sm bg-primary/10',
                              )}
                            >
                              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {author}
                              </p>
                              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                              {cards.length > 0 && (
                                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                                  {cards.map((p) => (
                                    <ProductChip key={p.id} product={p} />
                                  ))}
                                </div>
                              )}
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                {when ? format(when, 'd MMM, HH:mm') : ''}
                              </p>
                            </div>
                            {!visitor && (
                              <Image
                                src="/marigo-ai-avatar.png"
                                alt=""
                                width={28}
                                height={28}
                                className="mt-1 h-7 w-7 shrink-0 rounded-full object-cover"
                              />
                            )}
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Bot className="mx-auto mb-3 h-12 w-12 opacity-30" />
                <p className="font-medium">Select a chat</p>
                <p className="text-sm">Pick a conversation on the left to read the transcript.</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Only signed-in shoppers&apos; chats are saved; visitors who chat before signing in leave no transcript.
        Nothing on this page writes to Firestore.
      </p>
    </div>
  );
}
