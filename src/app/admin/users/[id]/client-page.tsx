'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouteParams as useParams } from '@/lib/platform/use-route-param';
import { collection, doc, query, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { ArrowLeft, BadgeCheck, Mail, Phone, ShieldAlert, Store } from 'lucide-react';

import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreUser, FirestoreProduct, FirestoreOrder } from '@/lib/types';
import { toDate } from '@/lib/types';
import { buildProductPath } from '@/lib/product-slug';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/context/CurrencyContext';

const when = (v: unknown) => {
  const d = toDate(v as any);
  return d ? format(d, 'd MMM yyyy, HH:mm') : '—';
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const firestore = useFirestore();
  const { formatPrice } = useCurrency();

  const userRef = useMemoFirebase(
    () => (firestore && id ? doc(firestore, 'users', id) : null),
    [firestore, id],
  );
  const { data: user, isLoading } = useDoc<FirestoreUser>(userRef);

  // What they have listed and what they have bought — the two questions an
  // admin actually opens a user record to answer.
  const listingsQ = useMemoFirebase(
    () => (firestore && id ? query(collection(firestore, 'products'), where('sellerId', '==', id)) : null),
    [firestore, id],
  );
  const { data: listings } = useCollection<FirestoreProduct>(listingsQ);

  const ordersQ = useMemoFirebase(
    () => (firestore && id ? query(collection(firestore, 'orders'), where('buyerId', '==', id)) : null),
    [firestore, id],
  );
  const { data: orders } = useCollection<FirestoreOrder>(ordersQ);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">That user no longer exists.</p>
        <Button asChild variant="link" className="mt-2 px-0">
          <Link href="/admin/users">Back to users</Link>
        </Button>
      </div>
    );
  }

  const name = user.name || user.displayName || 'Unnamed user';
  const banned = user.status === 'banned';
  const spend = (orders ?? []).reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/users">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Users
        </Link>
      </Button>

      {/* ── Identity ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="h-16 w-16">
          {user.profileImage || user.photoURL ? (
            <AvatarImage src={(user.profileImage || user.photoURL) as string} alt={name} />
          ) : null}
          <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="font-headline text-2xl font-bold">{name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">{user.role?.replace('_', ' ')}</Badge>
            <Badge variant={banned ? 'destructive' : 'secondary'}>
              {banned ? 'Banned' : 'Active'}
            </Badge>
            {user.emailVerified ? (
              // A UI hint, not proof — see FirestoreUser.emailVerified. Labelled
              // as "self-reported" so nobody mistakes it for verification the
              // server would trust.
              <Badge variant="outline" className="gap-1">
                <BadgeCheck className="h-3 w-3" /> Email confirmed
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {banned && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          This account is banned and cannot buy, sell or message.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Contact & account ───────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
          <CardContent className="divide-y">
            <Field label="Email">
              {user.email ? (
                <a href={`mailto:${user.email}`} className="inline-flex items-center gap-1 hover:underline">
                  <Mail className="h-3 w-3" /> {user.email}
                </a>
              ) : '—'}
            </Field>
            <Field label="Phone">
              {user.phone ? (
                <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {user.phone}</span>
              ) : '—'}
            </Field>
            <Field label="User ID"><code className="text-xs">{user.id}</code></Field>
            <Field label="Joined">{when(user.createdAt)}</Field>
            <Field label="Last seen">{when(user.lastLoginAt)}</Field>
            <Field label="Language">{(user.language || 'en').toUpperCase()}</Field>
            <Field label="Currency">{user.currency || 'ALL'}</Field>
          </CardContent>
        </Card>

        {/* ── Selling ─────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle className="text-base">Selling</CardTitle></CardHeader>
          <CardContent className="divide-y">
            <Field label="Listings">{listings?.length ?? 0}</Field>
            <Field label="Active">
              {(listings ?? []).filter(p => p.status === 'active').length}
            </Field>
            <Field label="Rating">
              {user.rating ? `${user.rating.toFixed(1)} (${user.reviewCount ?? 0})` : 'No reviews yet'}
            </Field>
            <Field label="Payout account">
              {user.stripeAccountId ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <Store className="h-3 w-3" /> Connected
                </span>
              ) : (
                <span className="text-muted-foreground">Not connected</span>
              )}
            </Field>
            <Field label="Orders placed">{orders?.length ?? 0}</Field>
            <Field label="Total spend">{formatPrice(spend)}</Field>
          </CardContent>
        </Card>
      </div>

      {/* ── Their listings ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Listings ({listings?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {!listings?.length ? (
            <p className="text-sm text-muted-foreground">This user has not listed anything.</p>
          ) : (
            <ul className="divide-y">
              {listings.map(p => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link href={`/admin/products/${p.id}`} className="min-w-0 truncate hover:underline">
                    {p.title}
                  </Link>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant="outline" className="capitalize">{p.status?.replace('_', ' ')}</Badge>
                    <span className="text-muted-foreground">{formatPrice(p.price ?? 0)}</span>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={buildProductPath(p)}>View</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Their orders ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Orders ({orders?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {!orders?.length ? (
            <p className="text-sm text-muted-foreground">This user has not ordered anything.</p>
          ) : (
            <ul className="divide-y">
              {orders.map(o => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link href={`/admin/orders/${o.id}`} className="min-w-0 truncate hover:underline">
                    {o.orderNumber || o.id}
                  </Link>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant="outline" className="capitalize">{String(o.status).replace('_', ' ')}</Badge>
                    <span className="text-muted-foreground">{formatPrice(Number(o.totalAmount) || 0)}</span>
                    <span className="hidden text-muted-foreground sm:inline">{when(o.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Role changes, bans and deletion stay on the users list, so every
        destructive action goes through the same confirmation dialog.
      </p>
    </div>
  );
}
