'use client';

import * as React from 'react';
import { notifyAdmin } from '@/lib/admin-notify';
import { useRouter } from 'next/navigation';
import { useRouteParams as useParams } from '@/lib/platform/use-route-param';
import Link from 'next/link';
import Image from 'next/image';
import { useFirestore, useUser, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, orderBy, limit, updateDoc, addDoc, arrayUnion, serverTimestamp, getDocs, increment } from 'firebase/firestore';
import type { FirestoreOrder, FirestoreUser, FirestoreConversation, FirestoreMessage } from '@/lib/types';
import { statusLabel } from '@/lib/order-status';
import { Money } from '@/components/admin/money';
import { orderMerchandise, orderShipping } from '@/lib/order-money';
import { toDate } from '@/lib/types';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { notifyOrderStatus } from '@/lib/notifications';
import { releaseOrderItems, markOrderItemsSoldIfDepleted } from '@/lib/order-inventory';

const ORDER_STATUSES = [
  { value: 'confirmed', label: 'Processing' },
  { value: 'in_preparation', label: 'In Preparation' },
  { value: 'prepared', label: 'Ready to Ship' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending_payment: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-blue-100 text-blue-800',
  in_preparation: 'bg-blue-100 text-blue-800',
  prepared: 'bg-indigo-100 text-indigo-800',
  shipped: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-200 text-green-900',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-orange-100 text-orange-800',
  cancel_requested: 'bg-amber-100 text-amber-800',
  refund_requested: 'bg-amber-100 text-amber-800',
};

interface ConversationWithMessages {
  conversation: FirestoreConversation;
  messages: FirestoreMessage[];
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const firestore = useFirestore();
  const { user: adminUser } = useUser();
  const { toast } = useToast();

  const [sellerNames, setSellerNames] = React.useState<Record<string, string>>({});
  const [conversations, setConversations] = React.useState<ConversationWithMessages[]>([]);
  const [convsLoading, setConvsLoading] = React.useState(false);
  const [statusUpdating, setStatusUpdating] = React.useState(false);
  const [confirmDialog, setConfirmDialog] = React.useState<{ open: boolean; status: string }>({ open: false, status: '' });

  const orderRef = useMemoFirebase(() => (id ? doc(firestore, 'orders', id) : null), [firestore, id]);
  const { data: order, isLoading: orderLoading } = useDoc<FirestoreOrder>(orderRef);

  const buyerRef = useMemoFirebase(() => (order?.buyerId ? doc(firestore, 'users', order.buyerId) : null), [firestore, order?.buyerId]);
  const { data: buyer } = useDoc<FirestoreUser>(buyerRef);

  // Batch fetch seller names
  React.useEffect(() => {
    if (!order || !order.items || order.items.length === 0) return;
    const uniqueSellerIds = [...new Set(order.items.map((item) => item.sellerId).filter(Boolean))];
    const missing = uniqueSellerIds.filter((sid) => !(sid in sellerNames));
    if (missing.length === 0) return;

    Promise.all(
      missing.map(async (sellerId) => {
        try {
          const snap = await getDocs(query(collection(firestore, 'users'), where('__name__', '==', sellerId)));
          if (!snap.empty) {
            const data = snap.docs[0].data() as FirestoreUser;
            return [sellerId, data.name || 'Unknown Seller'] as const;
          }
          return [sellerId, 'Unknown Seller'] as const;
        } catch {
          return [sellerId, 'Unknown Seller'] as const;
        }
      })
    ).then((results) => {
      setSellerNames((prev) => {
        const next = { ...prev };
        for (const [sid, name] of results) next[sid] = name;
        return next;
      });
    });
  }, [order, firestore, sellerNames]);

  // Fetch conversations and messages for order items
  React.useEffect(() => {
    if (!order || !order.items || order.items.length === 0) return;
    setConvsLoading(true);

    const productIds = order.items.map((item) => item.id);
    const fetchAll = async () => {
      const allConvs: ConversationWithMessages[] = [];
      for (const productId of productIds) {
        try {
          const convSnap = await getDocs(query(collection(firestore, 'conversations'), where('productId', '==', productId)));
          for (const convDoc of convSnap.docs) {
            const conv = { ...convDoc.data(), id: convDoc.id } as FirestoreConversation;
            const msgsSnap = await getDocs(query(collection(firestore, `conversations/${convDoc.id}/messages`), orderBy('createdAt', 'asc')));
            const msgs = msgsSnap.docs.map((m) => ({ ...m.data(), id: m.id } as FirestoreMessage));
            allConvs.push({ conversation: conv, messages: msgs });
          }
        } catch (err) {
          console.error('Error fetching conversations:', err);
        }
      }
      setConversations(allConvs);
      setConvsLoading(false);
    };
    fetchAll();
  }, [order, firestore]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!firestore || !adminUser || !order) return;
    setStatusUpdating(true);
    try {
      await updateDoc(doc(firestore, 'orders', order.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        statusHistory: arrayUnion({
          status: newStatus,
          at: new Date().toISOString(),
          by: adminUser.uid,
        }),
      });

      // Cancelling/refunding restores stock and flips listings back to
      // "active". Completing finalizes the sale — only listings that ran
      // out of stock during this order flip "reserved" → "sold"; listings
      // with remaining stock stay "active".
      const wasTerminal = order.status === 'cancelled' || order.status === 'refunded';
      if ((newStatus === 'cancelled' || newStatus === 'refunded') && !wasTerminal) {
        await releaseOrderItems(firestore, order.items as any);
        // Alert the platform inbox, but only on the transition — re-saving an
        // already-cancelled order must not mail it again.
        if (newStatus === 'cancelled') {
          void notifyAdmin(adminUser, {
            event: 'order_cancelled',
            orderId: order.id,
            previousStatus: order.status,
          });
        }
      } else if (newStatus === 'completed' && order.status !== 'completed') {
        await markOrderItemsSoldIfDepleted(firestore, order.items as any);
        // Bump the seller-badge counter — one increment per unique seller in
        // the order, so a seller who shipped multiple items in the same order
        // still counts as a single "sale" against their badge tier.
        const uniqueSellers = Array.from(new Set((order.sellerIds || []).filter(Boolean)));
        await Promise.all(
          uniqueSellers.map((sellerId) =>
            updateDoc(doc(firestore, 'users', sellerId), { salesCount: increment(1) })
              .catch((err) => console.warn('salesCount bump failed:', err))
          ),
        );
      }

      // Notify the buyer + every seller involved so the change is visible
      // immediately in the bell badge.
      const buyerLink = `/profile/orders/${order.id}`;
      const sellerLink = `/profile/listings/sales/${order.id}`;
      const firstItem = order.items?.[0];
      const productTitle = firstItem?.title;
      const productImage = firstItem?.image;
      const notifyTargets: Array<{ userId: string; audience: 'buyer' | 'seller'; link: string }> = [];
      if (order.buyerId) {
        notifyTargets.push({ userId: order.buyerId, audience: 'buyer', link: buyerLink });
      }
      Array.from(new Set(order.sellerIds || [])).forEach((sellerId) => {
        if (sellerId) notifyTargets.push({ userId: sellerId, audience: 'seller', link: sellerLink });
      });

      await Promise.all(
        notifyTargets.map(({ userId, audience, link }) =>
          notifyOrderStatus({
            firestore,
            userId,
            orderNumber: order.orderNumber,
            status: newStatus,
            link,
            audience,
            productTitle,
            productImage,
          }).then((result) => {
            if (!result) console.error(`[admin] notification failed for ${audience} userId=${userId}`);
            return result;
          }),
        ),
      );

      await addDoc(collection(firestore, 'admin_logs'), {
        adminId: adminUser.uid,
        adminName: adminUser.displayName || 'Admin',
        actionType: 'order_status_updated',
        details: `Updated order #${order.orderNumber} status to "${newStatus}"`,
        targetId: order.id,
        timestamp: serverTimestamp(),
      });
      toast({ title: 'Status Updated', description: `Order #${order.orderNumber} is now "${newStatus}".` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update order status.' });
    } finally {
      setStatusUpdating(false);
      setConfirmDialog({ open: false, status: '' });
    }
  };

  const onStatusChange = (newStatus: string) => {
    if (newStatus === 'cancelled' || newStatus === 'refunded') {
      setConfirmDialog({ open: true, status: newStatus });
    } else {
      handleStatusUpdate(newStatus);
    }
  };

  if (orderLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Order not found.</p>
        <Button variant="ghost" className="mt-4" asChild>
          <Link href="/admin/orders"><ArrowLeft className="mr-2 h-4 w-4" />Back to Orders</Link>
        </Button>
      </div>
    );
  }

  const createdDate = toDate(order.createdAt);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/orders"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold">Order #{order.orderNumber}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Order Info */}
        <Card>
          <CardHeader><CardTitle>Order Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge className={STATUS_COLORS[order.status] || ''}>{statusLabel(order.status, 'admin')}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Date</span>
              <span className="text-sm">{createdDate ? format(createdDate, 'd MMM yyyy, HH:mm') : 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Payment</span>
              <span className="text-sm capitalize">{order.paymentMethod}</span>
            </div>
            {/* Goods and delivery apart: commission is owed on the first and
                the courier is owed the second, so an operator following an
                order needs both, not one figure. Older orders lack the stored
                fields; the helpers derive them. */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Items</span>
              <span className="text-sm"><Money eur={orderMerchandise(order)} /></span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Delivery</span>
              <span className="text-sm"><Money eur={orderShipping(order)} /></span>
            </div>
            {order.discountAmount != null && order.discountAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Discount</span>
                <span className="text-sm text-green-600">-<Money eur={order.discountAmount} /></span>
              </div>
            )}
            {order.taxAmount != null && order.taxAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tax</span>
                <span className="text-sm"><Money eur={order.taxAmount} /></span>
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-sm font-medium">Total{order.paymentMethod === 'cod' ? ' · cash on delivery' : ''}</span>
              <span className="text-sm font-semibold"><Money eur={order.totalAmount} /></span>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Address */}
        <Card>
          <CardHeader><CardTitle>Shipping Address</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{order.shippingAddress.fullName}</p>
            <p>{order.shippingAddress.phone}</p>
            <p>{order.shippingAddress.address}</p>
            <p>{order.shippingAddress.city}, {order.shippingAddress.postal}</p>
            <p>{order.shippingAddress.country}</p>
          </CardContent>
        </Card>
      </div>

      {/* Status History */}
      {order.statusHistory && order.statusHistory.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Status history</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {[...order.statusHistory]
                .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
                .map((entry, i) => (
                  <li key={`${entry.status}-${entry.at}-${i}`} className="flex justify-between gap-4 border-b pb-2 last:border-b-0">
                    <span className="font-medium">{statusLabel(entry.status, 'admin')}</span>
                    <span className="text-muted-foreground">{format(new Date(entry.at), 'd MMM yyyy · HH:mm')}</span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card>
        <CardHeader><CardTitle>Items ({order.items.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {order.items.map((item) => (
              <Link
                key={item.id}
                href={`/admin/products/${item.id}`}
                className="flex items-center gap-4 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md">
                  <Image src={item.image} alt={item.title} fill className="object-cover" sizes="48px" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.brand}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{item.price.toFixed(2)} EUR</p>
                  <p className="text-xs text-muted-foreground">{sellerNames[item.sellerId] || 'Loading...'}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chat History */}
      <Card>
        <CardHeader><CardTitle>Chat History</CardTitle></CardHeader>
        <CardContent>
          {convsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No messages found for this order.</p>
          ) : (
            <div className="space-y-6">
              {conversations.map((cw) => {
                const isBuyer = (senderId: string) => senderId === order.buyerId;
                const getSenderName = (senderId: string) => {
                  const participant = cw.conversation.participantDetails?.find((p) => p.userId === senderId);
                  return participant?.name || 'Unknown';
                };

                return (
                  <div key={cw.conversation.id} className="space-y-3">
                    <h4 className="text-sm font-semibold border-b pb-2">{cw.conversation.productTitle}</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {cw.messages.map((msg) => {
                        const isB = isBuyer(msg.senderId);
                        const msgDate = toDate(msg.createdAt);
                        return (
                          <div key={msg.id} className={`flex ${isB ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[75%] rounded-lg px-3 py-2 ${isB ? 'bg-muted' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                              <p className="text-xs font-medium mb-1">{getSenderName(msg.senderId)}</p>
                              <p className="text-sm">{msg.content}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {msgDate ? format(msgDate, 'HH:mm') : ''}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={order.status} onValueChange={onStatusChange} disabled={statusUpdating}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Update status" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        title={`Confirm ${confirmDialog.status}`}
        description={`Are you sure you want to mark order #${order.orderNumber} as "${confirmDialog.status}"? This action may trigger refund processing.`}
        actionLabel={confirmDialog.status === 'cancelled' ? 'Cancel Order' : 'Refund Order'}
        variant="destructive"
        onConfirm={() => handleStatusUpdate(confirmDialog.status)}
        isLoading={statusUpdating}
      />
    </div>
  );
}
