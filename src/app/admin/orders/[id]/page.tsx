'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useFirestore, useUser, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, orderBy, limit, updateDoc, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import type { FirestoreOrder, FirestoreUser, FirestoreConversation, FirestoreMessage } from '@/lib/types';
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

const ORDER_STATUSES = [
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending_payment: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  completed: 'bg-green-200 text-green-900',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-orange-100 text-orange-800',
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
      await updateDoc(doc(firestore, 'orders', order.id), { status: newStatus });
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
              <Badge className={STATUS_COLORS[order.status] || ''}>{order.status}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Date</span>
              <span className="text-sm">{createdDate ? format(createdDate, 'd MMM yyyy, HH:mm') : 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Payment</span>
              <span className="text-sm capitalize">{order.paymentMethod}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-sm font-semibold">{order.totalAmount.toFixed(2)} EUR</span>
            </div>
            {order.discountAmount != null && order.discountAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Discount</span>
                <span className="text-sm text-green-600">-{order.discountAmount.toFixed(2)} EUR</span>
              </div>
            )}
            {order.taxAmount != null && order.taxAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tax</span>
                <span className="text-sm">{order.taxAmount.toFixed(2)} EUR</span>
              </div>
            )}
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
