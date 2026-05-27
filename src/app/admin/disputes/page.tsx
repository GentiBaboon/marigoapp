'use client';

import * as React from 'react';
import { collection, query, orderBy, doc, updateDoc, addDoc, getDoc, setDoc, increment, serverTimestamp, arrayUnion, Timestamp } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import type { FirestoreDispute, DisputeMessage, FirestoreOrder } from '@/lib/types';
import { notifyOrderStatus } from '@/lib/notifications';
import { releaseOrderItems } from '@/lib/order-inventory';
import { recordRefundForDispute, recordReturn } from '@/lib/order-lifecycle';
import { toDate, disputeKindLabel } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, ChevronDown, ChevronUp, MessageSquare, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

// Display-only labels for the persisted dispute status. We keep the stored
// values (`resolved` / `closed`) for backwards compatibility but show the
// product-facing wording (`Request accepted` / `Request denied`) everywhere.
const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  investigating: 'Investigating',
  resolved: 'Request accepted',
  closed: 'Request denied',
};

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  open: 'outline',
  investigating: 'default',
  resolved: 'secondary',
  closed: 'destructive',
};

const statusFlow: Record<string, string[]> = {
  open: ['investigating'],
  investigating: ['resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
};

function DisputeCard({ dispute }: { dispute: FirestoreDispute }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // Fall back to the order's first item if the dispute doc itself doesn't
  // carry product info (legacy rows written before the schema change).
  const needsOrderLookup = !dispute.productTitle && !!dispute.orderId;
  const orderRef = useMemoFirebase(
    () => (needsOrderLookup && firestore ? doc(firestore, 'orders', dispute.orderId) : null),
    [firestore, needsOrderLookup, dispute.orderId],
  );
  const { data: linkedOrder } = useDoc<FirestoreOrder>(orderRef);
  const linkedItem = linkedOrder?.items?.[0];
  const productTitle = dispute.productTitle || linkedItem?.title || `Order #${dispute.orderNumber}`;
  const productImage = dispute.productImage || linkedItem?.image || '';
  const productId = dispute.productId || linkedItem?.id || '';

  const [expanded, setExpanded] = React.useState(false);
  const [newMessage, setNewMessage] = React.useState('');
  const [resolution, setResolution] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    actionLabel: string;
    newStatus: string;
  }>({ open: false, title: '', description: '', actionLabel: '', newStatus: '' });
  const [isActing, setIsActing] = React.useState(false);

  const logAction = async (actionType: string, details: string, targetId: string) => {
    await addDoc(collection(firestore, 'admin_logs'), {
      adminId: user?.uid || '',
      adminName: user?.displayName || user?.email || 'Admin',
      actionType,
      details,
      targetId,
      timestamp: serverTimestamp(),
    });
  };

  const handleStatusChange = (newStatus: string) => {
    const nextLabel = STATUS_LABEL[newStatus] || newStatus;
    const curLabel = STATUS_LABEL[dispute.status] || dispute.status;
    setConfirmDialog({
      open: true,
      title: nextLabel,
      description: `Change dispute for order #${dispute.orderNumber} from "${curLabel}" to "${nextLabel}"?`,
      actionLabel: nextLabel,
      newStatus,
    });
  };

  const confirmStatusChange = async () => {
    setIsActing(true);
    try {
      const updateData: Record<string, any> = {
        status: confirmDialog.newStatus,
        updatedAt: serverTimestamp(),
      };
      if (confirmDialog.newStatus === 'resolved' && resolution.trim()) {
        updateData.resolution = resolution.trim();
      }
      await updateDoc(doc(firestore, 'disputes', dispute.id), updateData);

      // Sync the linked order so it doesn't get stuck in *_requested.
      // Resolve = honor the request (cancel/refund the order). Close without
      // resolving = the request was denied; revert to the prior status.
      if (
        (confirmDialog.newStatus === 'resolved' || confirmDialog.newStatus === 'closed') &&
        dispute.orderId
      ) {
        try {
          const orderRef = doc(firestore, 'orders', dispute.orderId);
          const orderSnap = await getDoc(orderRef);
          if (orderSnap.exists()) {
            const orderData = orderSnap.data() as FirestoreOrder;
            const isCancelSrc =
              dispute.source === 'buyer_cancel_request' ||
              dispute.source === 'seller_cancel_request';
            const isRefundSrc = dispute.source === 'buyer_refund_request';
            const inRequested =
              orderData.status === 'cancel_requested' ||
              orderData.status === 'refund_requested';

            let nextStatus: string | null = null;
            // ── Shopify-style lifecycle hook ──────────────────────────────────
            // When the dispute is resolved, spawn the appropriate child record:
            // cancellation → Refund (no Return; nothing shipped)
            // refund_request → Refund (no Return; item missing or undelivered)
            // return_request → Return (Refund follows after item received)
            // Each creates a finance-ledger row + cross-links back on the order.
            const isReturnSrc =
              dispute.disputeType === 'return_request' ||
              dispute.source === 'buyer_return_request';
            if (confirmDialog.newStatus === 'resolved') {
              if (isCancelSrc) {
                // Cancellation accepted → order is immediately cancelled and a
                // refund is booked (nothing shipped, so no return).
                nextStatus = 'cancelled';
                await recordRefundForDispute({
                  firestore,
                  order: { ...orderData, id: dispute.orderId } as FirestoreOrder,
                  dispute,
                  reason: resolution.trim() || 'Cancellation approved',
                  type: 'cancellation',
                  processedBy: user?.uid,
                  processedByName: user?.displayName || 'Admin',
                }).catch((e) => console.warn('[disputes] recordRefundForDispute failed', e));
              } else if (isRefundSrc || isReturnSrc) {
                // Refund / return request accepted → order enters the Return
                // flow (item must come back before money moves). A Return
                // record is created in /admin/returns; the actual refund is
                // booked there once the item is received & inspected.
                nextStatus = 'return_initiated';
                await recordReturn({
                  firestore,
                  order: { ...orderData, id: dispute.orderId } as FirestoreOrder,
                  reason: resolution.trim() || dispute.reason || 'Return approved',
                  type: 'return',
                  disputeId: dispute.id,
                  buyerName: dispute.buyerName,
                  processedBy: user?.uid,
                }).catch((e) => console.warn('[disputes] recordReturn failed', e));
              }
            } else if (confirmDialog.newStatus === 'closed' && inRequested) {
              // Revert: find the most recent status before the request was opened.
              const history = Array.isArray(orderData.statusHistory) ? orderData.statusHistory : [];
              const prior = [...history]
                .reverse()
                .find(
                  (h: any) =>
                    h?.status &&
                    h.status !== 'cancel_requested' &&
                    h.status !== 'refund_requested',
                );
              nextStatus = prior?.status || (isRefundSrc ? 'completed' : 'confirmed');
            }

            if (nextStatus && nextStatus !== orderData.status) {
              await updateDoc(orderRef, {
                status: nextStatus,
                updatedAt: serverTimestamp(),
                statusHistory: arrayUnion({
                  status: nextStatus,
                  at: new Date().toISOString(),
                  by: user?.uid || 'admin',
                }),
              });

              // Cancelled/refunded → restore stock and flip listings active.
              if (nextStatus === 'cancelled' || nextStatus === 'refunded') {
                await releaseOrderItems(firestore, orderData.items as any);
              }

              const firstItem = orderData.items?.[0];
              notifyOrderStatus({
                firestore,
                userId: orderData.buyerId,
                orderNumber: dispute.orderNumber,
                status: nextStatus,
                link: `/profile/orders/${dispute.orderId}`,
                audience: 'buyer',
                productTitle: firstItem?.title,
                productImage: firstItem?.image,
              }).catch(() => null);
              Array.from(new Set(orderData.sellerIds || [])).forEach((sellerId) => {
                notifyOrderStatus({
                  firestore,
                  userId: sellerId,
                  orderNumber: dispute.orderNumber,
                  status: nextStatus!,
                  link: `/profile/listings/sales/${dispute.orderId}`,
                  audience: 'seller',
                  productTitle: firstItem?.title,
                  productImage: firstItem?.image,
                }).catch(() => null);
              });
            }
          }
        } catch (e) {
          console.warn('Could not sync linked order on dispute close', e);
        }
      }

      // Mirror status to the linked conversation (if any) so the seller's
      // chat thread shows it as ended and becomes read-only.
      if (
        confirmDialog.newStatus === 'resolved' ||
        confirmDialog.newStatus === 'closed'
      ) {
        try {
          const convId = `dispute_${dispute.id}`;
          const convRef = doc(firestore, 'conversations', convId);
          const convSnap = await getDoc(convRef);
          if (convSnap.exists()) {
            const now = Timestamp.now();
            await updateDoc(convRef, {
              caseClosed: true,
              caseStatus: confirmDialog.newStatus,
              lastMessage: `Case ${confirmDialog.newStatus}.`,
              lastMessageAt: now,
            });
            await addDoc(collection(firestore, 'conversations', convId, 'messages'), {
              senderId: user?.uid || 'system',
              senderName: 'Marigo Support',
              senderRole: 'system',
              content: `Case ${confirmDialog.newStatus}${resolution.trim() ? ` — ${resolution.trim()}` : '.'}`,
              read: false,
              createdAt: now,
            });
          }
        } catch (e) {
          console.warn('Could not close mirrored conversation', e);
        }
      }

      await logAction(
        'dispute_status_changed',
        `Changed dispute status to "${confirmDialog.newStatus}" for order #${dispute.orderNumber}`,
        dispute.id
      );
      toast({
        title: 'Status Updated',
        description: `Dispute status changed to "${STATUS_LABEL[confirmDialog.newStatus] || confirmDialog.newStatus}".`,
      });
      setConfirmDialog((prev) => ({ ...prev, open: false }));
      setResolution('');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update dispute status.' });
    } finally {
      setIsActing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setIsSending(true);
    try {
      const adminName = user?.displayName || user?.email || 'Admin';
      // Buyers and sellers see admin messages as coming from "Marigo Support"
      // with the Marigo logo as the avatar, not the admin's email/photo.
      const supportName = 'Marigo Support';
      const supportAvatar = '/app-icon.png';
      const messageText = newMessage.trim();
      const message: Omit<DisputeMessage, 'createdAt'> & { createdAt: any } = {
        senderId: user?.uid || '',
        senderName: adminName,
        senderRole: 'admin',
        content: messageText,
        createdAt: new Date().toISOString(),
      };
      await updateDoc(doc(firestore, 'disputes', dispute.id), {
        messages: arrayUnion(message),
        updatedAt: serverTimestamp(),
      });

      // Mirror the admin reply into a real conversation so the seller can see
      // it under their Messages tab. The conversation is keyed deterministically
      // off the dispute id so subsequent admin replies append to the same thread.
      if (user?.uid) {
        try {
          const convId = `dispute_${dispute.id}`;
          const convRef = doc(firestore, 'conversations', convId);
          const convSnap = await getDoc(convRef);
          // Use client-side Timestamp.now() so `lastMessageAt` is populated
          // immediately and the seller's `orderBy('lastMessageAt')` query
          // doesn't filter the doc out while a serverTimestamp() resolves.
          const now = Timestamp.now();
          // Include both the buyer and the seller in the dispute conversation
          // so either side can see the admin's replies under their Messages.
          const counterparts = Array.from(
            new Set([dispute.sellerId, dispute.buyerId].filter(Boolean) as string[]),
          );
          const allParticipants = Array.from(new Set([user.uid, ...counterparts]));
          if (!convSnap.exists()) {
            const details: any[] = [{ userId: user.uid, name: supportName, avatar: supportAvatar, role: 'admin' }];
            if (dispute.sellerId) details.push({ userId: dispute.sellerId, name: dispute.sellerName || 'Seller', role: 'seller' });
            if (dispute.buyerId && dispute.buyerId !== dispute.sellerId)
              details.push({ userId: dispute.buyerId, name: dispute.buyerName || 'Buyer', role: 'buyer' });
            const initialUnread: Record<string, number> = {};
            counterparts.forEach((uid) => { initialUnread[uid] = 1; });
            await setDoc(convRef, {
              participants: allParticipants,
              participantDetails: details,
              productId,
              productTitle,
              productImage,
              lastMessage: messageText,
              lastMessageAt: now,
              unreadCount: initialUnread,
              source: 'dispute',
              disputeId: dispute.id,
              disputeKind: dispute.source || 'dispute',
            });
          } else {
            // Make sure all parties are participants on legacy docs that may
            // have been created with only one side, and bump unread counts.
            // Also overwrite participantDetails so the admin entry shows up
            // as "Marigo Support" with the logo (older threads were created
            // with the admin's email + photo).
            const rebuiltDetails: any[] = [
              { userId: user.uid, name: supportName, avatar: supportAvatar, role: 'admin' },
            ];
            if (dispute.sellerId)
              rebuiltDetails.push({ userId: dispute.sellerId, name: dispute.sellerName || 'Seller', role: 'seller' });
            if (dispute.buyerId && dispute.buyerId !== dispute.sellerId)
              rebuiltDetails.push({ userId: dispute.buyerId, name: dispute.buyerName || 'Buyer', role: 'buyer' });
            const update: Record<string, any> = {
              participants: arrayUnion(...allParticipants),
              participantDetails: rebuiltDetails,
              lastMessage: messageText,
              lastMessageAt: now,
              source: 'dispute',
              disputeId: dispute.id,
              disputeKind: dispute.source || 'dispute',
            };
            counterparts.forEach((uid) => {
              update[`unreadCount.${uid}`] = increment(1);
            });
            await updateDoc(convRef, update);
          }
          await addDoc(collection(firestore, 'conversations', convId, 'messages'), {
            senderId: user.uid,
            senderName: supportName,
            senderRole: 'admin',
            content: messageText,
            read: false,
            createdAt: now,
          });
          console.info('[dispute mirror] conversation written', convId);

          // Bell ping for both counterparts (buyer + seller) so neither misses it.
          const { notifyUser } = await import('@/lib/notifications');
          const preview = messageText.length > 80 ? messageText.slice(0, 77) + '…' : messageText;
          counterparts.forEach((uid) => {
            notifyUser({
              firestore,
              userId: uid,
              title: `${productTitle} — Message from support`,
              message: preview,
              type: 'new_message',
              link: `/messages/${convId}`,
              imageUrl: productImage || undefined,
            }).catch(() => null);
          });
        } catch (e) {
          console.warn('Could not mirror dispute message to conversation', e);
        }
      }

      await logAction('dispute_message_sent', `Sent message on dispute for order #${dispute.orderNumber}`, dispute.id);
      toast({ title: 'Message Sent', description: 'Your message has been added to the dispute thread.' });
      setNewMessage('');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send message.' });
    } finally {
      setIsSending(false);
    }
  };

  const availableStatuses = statusFlow[dispute.status] || [];
  const createdDate = toDate(dispute.createdAt);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-3 min-w-0">
              {productImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={productImage}
                  alt=""
                  className="h-10 w-10 rounded-md object-cover bg-muted flex-shrink-0"
                />
              )}
              <span className="truncate">{productTitle}</span>
            </CardTitle>
            <Badge variant={statusVariant[dispute.status] || 'outline'}>
              {STATUS_LABEL[dispute.status] || dispute.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{disputeKindLabel(dispute.source)}</span>
            {' · '}Order #{dispute.orderNumber} · {createdDate ? format(createdDate, 'd MMM yyyy') : '-'}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Buyer:</span>{' '}
              <span className="font-medium">{dispute.buyerName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Seller:</span>{' '}
              <span className="font-medium">{dispute.sellerName}</span>
            </div>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Reason:</span>{' '}
            <span>{dispute.reason}</span>
          </div>
          {dispute.resolution && (
            <div className="text-sm rounded-md bg-muted p-3">
              <span className="font-medium">Resolution:</span> {dispute.resolution}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Messages ({dispute.messages?.length || 0})
            </span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {expanded && (
            <div className="space-y-3">
              <Separator />
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-3 pr-4">
                  {(dispute.messages || []).map((msg, idx) => {
                    const msgDate = toDate(msg.createdAt);
                    const roleColors: Record<string, string> = {
                      buyer: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
                      seller: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
                      admin: 'bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800',
                    };
                    return (
                      <div
                        key={idx}
                        className={`rounded-md border p-3 ${roleColors[msg.senderRole] || ''}`}
                      >
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span className="font-medium">
                            {msg.senderName}{' '}
                            <Badge variant="outline" className="text-[10px] ml-1 px-1 py-0">
                              {msg.senderRole}
                            </Badge>
                          </span>
                          <span>{msgDate ? format(msgDate, 'd MMM yyyy HH:mm') : '-'}</span>
                        </div>
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    );
                  })}
                  {(!dispute.messages || dispute.messages.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No messages yet.</p>
                  )}
                </div>
              </ScrollArea>

              {dispute.status !== 'closed' && (
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="min-h-[60px]"
                  />
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={isSending || !newMessage.trim()}
                    className="shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>

        {availableStatuses.length > 0 && (
          <CardFooter className="flex items-center gap-3 border-t pt-4">
            {availableStatuses.includes('resolved') && (
              <Textarea
                placeholder="Resolution notes (optional)..."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="min-h-[40px] flex-1"
              />
            )}
            <Select onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Change status" />
              </SelectTrigger>
              <SelectContent>
                {availableStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s] || (s.charAt(0).toUpperCase() + s.slice(1))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardFooter>
        )}
      </Card>

      <ConfirmActionDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        actionLabel={confirmDialog.actionLabel}
        variant="default"
        onConfirm={confirmStatusChange}
        isLoading={isActing}
      />
    </>
  );
}

export default function AdminDisputesPage() {
  const firestore = useFirestore();

  const disputesQuery = useMemoFirebase(
    () => query(collection(firestore, 'disputes'), orderBy('createdAt', 'desc')),
    [firestore]
  );
  const { data: disputes, isLoading } = useCollection<FirestoreDispute>(disputesQuery);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Disputes</h1>
          <p className="text-muted-foreground">
            Manage buyer-seller disputes and facilitate resolutions.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {disputes && disputes.length > 0 ? (
          disputes.map((dispute) => (
            <DisputeCard key={dispute.id} dispute={dispute} />
          ))
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No disputes found.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
