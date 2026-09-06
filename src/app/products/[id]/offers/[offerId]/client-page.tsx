'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useUser, useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { toDate, type FirestoreProduct, type FirestoreOffer, type FirestoreUser } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Loader2, MessageSquare, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useCurrency } from '@/context/CurrencyContext';
import { useRouteParam } from '@/lib/platform/use-route-param';
import { useAppRouter as useRouter } from '@/lib/platform/use-app-router';
import { useCart } from '@/context/CartContext';
import { notifyUser } from '@/lib/notifications';
import { notifyOfferEmail } from '@/lib/offer-notify';
import {
  allowedActions,
  currentAmount,
  effectiveStatus,
  historyEntry,
  historyLabel,
  offerStatusLabel,
  roleFor,
  statusAfter,
  validateCounterAmount,
  type OfferAction,
} from '@/lib/offers';

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  countered: 'bg-blue-100 text-blue-800 border-blue-200',
  accepted: 'bg-green-100 text-green-800 border-green-200',
  declined: 'bg-red-100 text-red-800 border-red-200',
  withdrawn: 'bg-muted text-muted-foreground border-border',
  expired: 'bg-muted text-muted-foreground border-border',
};

function OfferPageSkeleton() {
  return (
    <div className="container mx-auto max-w-lg px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-md" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </div>
      <div className="mt-8 flex flex-col items-center gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

function OfferTimeline({
  offer,
  buyer,
  seller,
}: {
  offer: FirestoreOffer;
  buyer: FirestoreUser | null;
  seller: FirestoreUser | null;
}) {
  const { formatPrice } = useCurrency();
  if (!offer.history?.length) return null;

  return (
    <div className="space-y-4">
      {offer.history.map((item: any, index: number) => {
        // `by_role` is authoritative; `by_user` is the fallback for rows
        // written before the role was recorded.
        const isSellerRow = item.by_role === 'seller' || item.by_user === seller?.id;
        const actor = isSellerRow ? seller : buyer;
        // Not every account has a `displayName` on its Firestore user doc, and
        // falling straight through to "User" made both sides of a negotiation
        // look like the same anonymous person. The name captured on the offer
        // itself is the better fallback, then the role, then the generic.
        const name =
          actor?.displayName?.trim() ||
          (isSellerRow ? undefined : offer.buyerName?.trim()) ||
          (isSellerRow ? 'Seller' : 'Buyer');
        const when = toDate(item.timestamp);
        return (
          <div key={index} className="flex items-start gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={actor?.photoURL ?? undefined} />
              <AvatarFallback>{name[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{name}</p>
              {/* A row written by an older client can carry a null timestamp;
                  reading `.seconds` off it used to throw and blank the page. */}
              <p className="text-xs text-muted-foreground">
                {when ? format(when, 'dd/MM/yy, HH:mm') : '—'}
              </p>
            </div>
            <p className="ml-auto font-semibold text-sm text-right">
              {historyLabel(item.action)}
              {item.amount != null ? `: ${formatPrice(item.amount)}` : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function OfferActions({
  offer,
  product,
  userRole,
}: {
  offer: FirestoreOffer;
  product: FirestoreProduct;
  userRole: 'buyer' | 'seller' | null;
}) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { addToCart } = useCart();
  const [isLoading, setIsLoading] = React.useState<OfferAction | null>(null);
  const [isCountering, setIsCountering] = React.useState(false);
  const [counterAmount, setCounterAmount] = React.useState('');
  const { formatPrice, currency, rates } = useCurrency();

  const status = effectiveStatus(offer);
  const actions = allowedActions(status, userRole);
  const onTable = currentAmount({ ...offer, status });

  const rate = rates?.[currency] ?? (currency === 'ALL' ? 93 : 1);
  const counterEur = counterAmount ? Number(counterAmount) / (rate || 1) : NaN;
  const counterCheck = validateCounterAmount(counterEur, product.price, onTable);

  const handleAction = async (action: OfferAction, amountEur?: number) => {
    if (!user || !firestore || !userRole) return;
    // Re-check here as well as in the render: a stale tab could still be
    // showing buttons for an offer the other side has already closed.
    if (!allowedActions(status, userRole).includes(action)) {
      toast({
        variant: 'destructive',
        title: 'No longer available',
        description: 'This offer has already moved on. Refresh to see where it stands.',
      });
      return;
    }

    setIsLoading(action);
    const nextStatus = statusAfter(action, userRole);
    const amount = amountEur != null ? Math.round(amountEur * 100) / 100 : onTable;

    const updateData: Record<string, any> = {
      status: nextStatus,
      updatedAt: serverTimestamp(),
      history: arrayUnion(
        historyEntry({ action, amount, byUser: user.uid, byRole: userRole }),
      ),
    };
    if (action === 'counter') updateData.counterOfferAmount = amount;
    if (action === 'accept') updateData.agreedPrice = amount;

    const offerRef = doc(firestore, 'products', product.id, 'offers', offer.id);

    try {
      await updateDoc(offerRef, updateData);

      const other = userRole === 'buyer' ? product.sellerId : offer.buyerId;
      const label = offerStatusLabel(nextStatus, userRole === 'buyer' ? 'seller' : 'buyer');
      void notifyUser({
        firestore,
        userId: other,
        type: 'offer_received',
        title: `${product.title} — ${label}`,
        message:
          action === 'counter'
            ? `Counter-offer of ${formatPrice(amount)}.`
            : `Your offer of ${formatPrice(amount)} was ${nextStatus}.`,
        link: `/products/${product.id}/offers/${offer.id}`,
      });
      if (action !== 'withdraw') {
        void notifyOfferEmail(user, {
          productId: product.id,
          offerId: offer.id,
          event: action === 'counter' ? 'countered' : (`${action}ed` as 'accepted' | 'declined'),
        });
      }

      toast({
        title: `Offer ${nextStatus}`,
        description:
          action === 'accept'
            ? `Agreed at ${formatPrice(amount)}.`
            : 'The other party has been notified.',
      });
      if (action === 'counter') setIsCountering(false);
    } catch (error: any) {
      console.error(`Error updating offer (${action}):`, error);
      if (error?.code === 'permission-denied') {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: offerRef.path,
            operation: 'update',
            requestResourceData: updateData,
          }),
        );
      }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not update the offer. Please try again.',
      });
    } finally {
      setIsLoading(null);
    }
  };

  /** An accepted offer is only worth something if it can be bought at the
   *  agreed price. Checkout re-derives that price server-side from this same
   *  offer document, so the cart entry is a convenience, not the authority. */
  const handleBuyAtAgreedPrice = () => {
    // The agreed price is the markdown here, so the line strikes through the
    // asking price rather than any earlier listing discount.
    addToCart({ ...product, price: onTable, originalPrice: product.price }, { quantity: 1 });
    router.push('/cart');
  };

  if (status === 'accepted') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-center">
          Agreed at <span className="font-semibold">{formatPrice(onTable)}</span>.
        </p>
        {userRole === 'buyer' ? (
          <Button className="w-full" onClick={handleBuyAtAgreedPrice}>
            <ShoppingBag className="mr-2 h-4 w-4" />
            Buy now at {formatPrice(onTable)}
          </Button>
        ) : (
          <p className="text-sm text-center text-muted-foreground">
            Waiting for the buyer to complete checkout.
          </p>
        )}
      </div>
    );
  }

  if (!actions.length) {
    return (
      <p className="text-sm text-center text-muted-foreground">
        {userRole
          ? `This offer has been ${status}.`
          : status === 'pending' || status === 'countered'
            ? 'This negotiation is between the buyer and the seller.'
            : `This offer has been ${status}.`}
      </p>
    );
  }

  if (isCountering) {
    return (
      <div className="space-y-3 pt-2">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          placeholder={`Your counter offer (${currency})`}
          value={counterAmount}
          onChange={(e) => setCounterAmount(e.target.value)}
          className="text-base"
        />
        {counterAmount !== '' && !counterCheck.ok && (
          <p className="text-sm text-destructive">{counterCheck.reason}</p>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setIsCountering(false)} className="w-full">
            Cancel
          </Button>
          <Button
            className="w-full"
            disabled={isLoading === 'counter' || !counterCheck.ok}
            onClick={() => handleAction('counter', counterEur)}
          >
            {isLoading === 'counter' ? <Loader2 className="animate-spin" /> : 'Send counter'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 pt-2">
      {actions.includes('accept') && (
        <Button onClick={() => handleAction('accept')} disabled={!!isLoading}>
          {isLoading === 'accept' ? <Loader2 className="animate-spin" /> : `Accept ${formatPrice(onTable)}`}
        </Button>
      )}
      {actions.includes('decline') && (
        <Button variant="outline" onClick={() => handleAction('decline')} disabled={!!isLoading}>
          {isLoading === 'decline' ? <Loader2 className="animate-spin" /> : 'Decline'}
        </Button>
      )}
      {actions.includes('counter') && (
        <Button
          variant="outline"
          className="col-span-2"
          onClick={() => setIsCountering(true)}
          disabled={!!isLoading}
        >
          Make a counter offer
        </Button>
      )}
      {actions.includes('withdraw') && (
        <Button
          variant="ghost"
          className="col-span-2 border"
          onClick={() => handleAction('withdraw')}
          disabled={!!isLoading}
        >
          {isLoading === 'withdraw' ? <Loader2 className="animate-spin" /> : 'Withdraw offer'}
        </Button>
      )}
    </div>
  );
}

export default function OfferDetailsPage() {
  // Read through the platform hook rather than the `params` prop: the native
  // bundle reaches this same component at /products/offer/?id=…&offerId=…
  const productId = useRouteParam('id') as string;
  const offerId = useRouteParam('offerId') as string;
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const [isChatLoading, setIsChatLoading] = React.useState(false);

  const productRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'products', productId) : null),
    [firestore, productId],
  );
  const { data: product, isLoading: isProductLoading } = useDoc<FirestoreProduct>(productRef);

  const offerRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'products', productId, 'offers', offerId) : null),
    [firestore, productId, offerId],
  );
  const { data: offer, isLoading: isOfferLoading } = useDoc<FirestoreOffer>(offerRef);

  const buyerId = offer?.buyerId;
  const buyerRef = useMemoFirebase(
    () => (firestore && buyerId ? doc(firestore, 'users', buyerId) : null),
    [firestore, buyerId],
  );
  const { data: buyer } = useDoc<FirestoreUser>(buyerRef);

  const sellerId = product?.sellerId;
  const sellerRef = useMemoFirebase(
    () => (firestore && sellerId ? doc(firestore, 'users', sellerId) : null),
    [firestore, sellerId],
  );
  const { data: seller } = useDoc<FirestoreUser>(sellerRef);

  const isLoading = isProductLoading || isOfferLoading;
  const userRole = roleFor(user?.uid, offer, product);

  const handleContactOther = async () => {
    if (!user || !product) return;
    setIsChatLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/start-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: product.id, sellerId: product.sellerId }),
      });
      const data = await res.json();
      if (data?.conversationId) router.push(`/messages/${data.conversationId}`);
      else router.push('/messages');
    } catch (err) {
      console.error('[offer] could not open conversation:', err);
      router.push('/messages');
    } finally {
      setIsChatLoading(false);
    }
  };

  if (isLoading) return <OfferPageSkeleton />;

  if (!product || !offer) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-8 text-center">
        <h1 className="text-xl font-bold">Offer not found</h1>
        <p className="text-muted-foreground">The requested product or offer could not be found.</p>
        <Button asChild variant="link" className="mt-4">
          <Link href="/home">Go to Homepage</Link>
        </Button>
      </div>
    );
  }

  const status = effectiveStatus(offer);
  const firstImage = product.images?.[0];
  const imageUrl =
    (typeof firstImage === 'string' ? firstImage : firstImage?.url) ||
    'https://placehold.co/80x80/E2E8F0/A0AEC0?text=MARIGO';
  const expires = toDate(offer.expiresAt);

  return (
    <div className="container mx-auto max-w-lg px-4 py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/products/${productId}`}>
            <ArrowLeft />
            <span className="sr-only">Back to product</span>
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Negotiation</h1>
        <Badge className={statusStyles[status] ?? statusStyles.expired}>
          {offerStatusLabel(status, userRole ?? 'buyer')}
        </Badge>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-md bg-muted overflow-hidden shrink-0">
            <Image src={imageUrl} alt={product.title} fill sizes="64px" className="object-cover" />
          </div>
          <div className="min-w-0">
            <p className="font-bold truncate">{product.title}</p>
            <p className="text-muted-foreground text-sm">Listed for {formatPrice(product.price)}</p>
            <p className="text-muted-foreground text-sm">
              On the table: <span className="font-semibold text-foreground">{formatPrice(currentAmount({ ...offer, status }))}</span>
            </p>
          </div>
        </div>
        {userRole && (
          <Button variant="outline" className="w-full" onClick={handleContactOther} disabled={isChatLoading}>
            {isChatLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MessageSquare className="mr-2 h-4 w-4" />
            )}
            Contact {userRole === 'buyer' ? 'seller' : 'buyer'}
          </Button>
        )}
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">
            Offer history
          </h3>
          {expires && (status === 'pending' || status === 'countered') && (
            <p className="text-xs text-muted-foreground">Expires {format(expires, 'dd MMM')}</p>
          )}
        </div>
        <OfferTimeline offer={offer} buyer={buyer} seller={seller} />
      </div>

      <div className="border rounded-lg p-4 bg-primary/5">
        <OfferActions offer={offer} product={product} userRole={userRole} />
      </div>
    </div>
  );
}
