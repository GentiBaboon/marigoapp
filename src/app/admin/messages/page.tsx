'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, MessagesSquare, Scale, Search, ShieldCheck, Users } from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';

import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { StatCard } from '@/components/admin/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { fetchMap } from '@/lib/fetch-map';
import { toDate, type FirestoreConversation, type FirestoreMessage, type FirestoreUser } from '@/lib/types';
import AdminMessagesLoading from './loading';

/** Newest conversations shown. */
const CONVERSATIONS_LIMIT = 100;
/** Longest transcript rendered. */
const MESSAGES_LIMIT = 300;

type Filter = 'all' | 'members' | 'dispute';

/**
 * `productImage` is typed as a string but some threads carry the listing's
 * image *object* (`{ url, thumbnailUrl }`) — truthy, so a bare guard let it
 * through to `next/image`, which rendered an empty `src` and logged an error
 * per row. Accept either shape.
 */
function imageUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  const img = value as { thumbnailUrl?: string; url?: string };
  return img.thumbnailUrl || img.url || null;
}

function participantName(conv: FirestoreConversation, uid: string, users: Map<string, FirestoreUser>): string {
  const detail = conv.participantDetails?.find((p) => p.userId === uid);
  const user = users.get(uid);
  return detail?.name || user?.name || user?.displayName || user?.email || `${uid.slice(0, 8)}…`;
}

function participantNames(conv: FirestoreConversation, users: Map<string, FirestoreUser>): string[] {
  return (conv.participants ?? []).map((uid) => participantName(conv, uid, users));
}

export default function AdminMessagesPage() {
  const firestore = useFirestore();
  const { user: adminUser } = useUser();
  const [users, setUsers] = React.useState<Map<string, FirestoreUser>>(new Map());
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<FirestoreMessage[] | null>(null);
  const [filter, setFilter] = React.useState<Filter>('all');
  const [search, setSearch] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  // One audit entry per conversation per visit, not one per click.
  const logged = React.useRef<Set<string>>(new Set());

  const convQuery = useMemoFirebase(
    () => query(collection(firestore, 'conversations'), orderBy('lastMessageAt', 'desc'), limit(CONVERSATIONS_LIMIT)),
    [firestore],
  );
  const { data: conversations, isLoading, error } = useCollection<FirestoreConversation>(convQuery);

  // `participantDetails` usually carries both names. Older threads and
  // renamed accounts fall back to the user document, joined once per person.
  React.useEffect(() => {
    if (!conversations) return;
    const missing = conversations
      .flatMap((c) => (c.participants ?? []).filter((uid) => !c.participantDetails?.some((p) => p.userId === uid && p.name)))
      .filter((uid) => uid && !users.has(uid));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, firestore]);

  React.useEffect(() => {
    if (!selectedId) {
      setMessages(null);
      return;
    }
    setMessages(null);
    const q = query(
      collection(firestore, 'conversations', selectedId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(MESSAGES_LIMIT),
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreMessage)));
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

  const selected = conversations?.find((c) => c.id === selectedId) ?? null;

  // This is private correspondence between two members. Reading it is
  // legitimate for moderation, and it should leave a trace: the same
  // `admin_logs` ledger every other operator action writes to.
  const openConversation = (conv: FirestoreConversation) => {
    setSelectedId(conv.id);
    if (!adminUser || logged.current.has(conv.id)) return;
    logged.current.add(conv.id);
    const names = participantNames(conv, users).join(' and ');
    addDoc(collection(firestore, 'admin_logs'), {
      adminId: adminUser.uid,
      adminName: adminUser.displayName || 'Admin',
      actionType: 'conversation_viewed',
      details: `Read the conversation between ${names}${conv.productTitle ? ` about "${conv.productTitle}"` : ''}`,
      targetId: conv.id,
      timestamp: serverTimestamp(),
    }).catch((err) => console.warn('[admin/messages] audit log failed', err));
  };

  const filtered = React.useMemo(() => {
    if (!conversations) return [];
    const needle = search.trim().toLowerCase();
    return conversations.filter((conv) => {
      const isDispute = conv.source === 'dispute';
      if (filter === 'members' && isDispute) return false;
      if (filter === 'dispute' && !isDispute) return false;
      if (!needle) return true;
      return [...participantNames(conv, users), conv.productTitle, conv.lastMessage]
        .some((v) => v?.toLowerCase().includes(needle));
    });
  }, [conversations, users, filter, search]);

  const stats = React.useMemo(() => {
    const all = conversations ?? [];
    const disputes = all.filter((c) => c.source === 'dispute').length;
    const people = new Set(all.flatMap((c) => c.participants ?? [])).size;
    return { total: all.length, members: all.length - disputes, disputes, people };
  }, [conversations]);

  if (isLoading && !conversations) return <AdminMessagesLoading />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground">
            Conversations between buyers and sellers. Read-only: an operator can read a thread for moderation,
            not take part in it, and every thread opened here is written to the activity log.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Could not load conversations: {String((error as any)?.message ?? error)}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Conversations"
          value={stats.total}
          icon={<MessagesSquare className="h-4 w-4 text-muted-foreground" />}
          description={stats.total >= CONVERSATIONS_LIMIT ? `Newest ${CONVERSATIONS_LIMIT} shown` : 'All time'}
        />
        <StatCard
          title="Buyer ↔ seller"
          value={stats.members}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          description="Started from a listing"
        />
        <StatCard
          title="Dispute threads"
          value={stats.disputes}
          icon={<Scale className="h-4 w-4 text-muted-foreground" />}
          description="Opened by a case"
        />
        <StatCard
          title="Members involved"
          value={stats.people}
          icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
          description="Distinct accounts"
        />
      </div>

      <div className="flex flex-col gap-4 lg:h-[calc(100vh-24rem)] lg:min-h-[480px] lg:flex-row">
        <Card className="flex max-h-[50vh] shrink-0 flex-col lg:max-h-none lg:w-96">
          <CardHeader className="space-y-3 pb-3">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="dispute">Disputes</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, listing or last message"
                className="h-9 pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="space-y-1 px-3 pb-3">
                {filtered.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    {conversations && conversations.length > 0 ? 'Nothing matches.' : 'No conversations yet.'}
                  </p>
                ) : (
                  filtered.map((conv) => {
                    const names = participantNames(conv, users);
                    const when = toDate(conv.lastMessageAt as any);
                    return (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => openConversation(conv)}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors',
                          selectedId === conv.id ? 'border border-primary/20 bg-primary/10' : 'hover:bg-muted',
                        )}
                      >
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
                          {(() => {
                            const src = imageUrl(conv.productImage);
                            return src ? <Image src={src} alt="" fill className="object-cover" sizes="44px" /> : null;
                          })()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">{names.join(' · ')}</span>
                            {when && (
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {formatDistanceToNow(when, { addSuffix: true })}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{conv.productTitle || 'No listing'}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {conv.lastMessage || 'No messages yet'}
                          </p>
                          {conv.source === 'dispute' && (
                            <Badge variant="outline" className="mt-1 gap-1 text-[10px]">
                              <Scale className="h-3 w-3" />
                              Dispute{conv.caseClosed ? ' · closed' : ''}
                            </Badge>
                          )}
                        </div>
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
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-base">{participantNames(selected, users).join(' and ')}</CardTitle>
                    <CardDescription className="truncate text-xs">
                      {selected.productId ? (
                        <Link href={`/admin/products/${selected.productId}`} className="hover:underline">
                          {selected.productTitle || 'View listing'}
                        </Link>
                      ) : (
                        'No listing attached'
                      )}
                      {selected.disputeId && (
                        <>
                          {' · '}
                          <Link href="/admin/disputes" className="hover:underline">
                            dispute case
                          </Link>
                        </>
                      )}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    Read-only
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-4">
                  {messages === null ? (
                    <p className="text-center text-sm text-muted-foreground">Loading transcript…</p>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground">No messages in this conversation.</p>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg) => {
                        const isStaff = msg.senderRole === 'admin' || msg.senderRole === 'system';
                        const first = selected.participants?.[0];
                        const left = !isStaff && msg.senderId === first;
                        const when = toDate(msg.createdAt as any);
                        const author = isStaff
                          ? msg.senderName || (msg.senderRole === 'system' ? 'System' : 'Marigo Support')
                          : participantName(selected, msg.senderId, users);
                        if (isStaff) {
                          return (
                            <div key={msg.id} className="flex justify-center">
                              <div className="max-w-[80%] rounded-lg border border-dashed px-3 py-2 text-center">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  {author}
                                </p>
                                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                                {when && <p className="mt-1 text-[10px] text-muted-foreground">{format(when, 'd MMM, HH:mm')}</p>}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={msg.id} className={cn('flex', left ? 'justify-start' : 'justify-end')}>
                            <div
                              className={cn(
                                'max-w-[75%] rounded-2xl px-4 py-2.5',
                                left ? 'rounded-bl-sm bg-muted' : 'rounded-br-sm bg-primary/10',
                              )}
                            >
                              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {author}
                              </p>
                              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                {when ? format(when, 'd MMM, HH:mm') : ''}
                              </p>
                            </div>
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
                <MessagesSquare className="mx-auto mb-3 h-12 w-12 opacity-30" />
                <p className="font-medium">Select a conversation</p>
                <p className="text-sm">Opening one is recorded in the activity log.</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
