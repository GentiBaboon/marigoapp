'use client';

import * as React from 'react';
import { collection, query, orderBy, doc, updateDoc, addDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import type { FirestoreDispute, DisputeMessage } from '@/lib/types';
import { toDate } from '@/lib/types';
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
    setConfirmDialog({
      open: true,
      title: `Change Status to "${newStatus}"`,
      description: `Change dispute for order #${dispute.orderNumber} from "${dispute.status}" to "${newStatus}"?`,
      actionLabel: `Set ${newStatus}`,
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
      await logAction(
        'dispute_status_changed',
        `Changed dispute status to "${confirmDialog.newStatus}" for order #${dispute.orderNumber}`,
        dispute.id
      );
      toast({
        title: 'Status Updated',
        description: `Dispute status changed to "${confirmDialog.newStatus}".`,
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
      const message: Omit<DisputeMessage, 'createdAt'> & { createdAt: any } = {
        senderId: user?.uid || '',
        senderName: user?.displayName || user?.email || 'Admin',
        senderRole: 'admin',
        content: newMessage.trim(),
        createdAt: new Date().toISOString(),
      };
      await updateDoc(doc(firestore, 'disputes', dispute.id), {
        messages: arrayUnion(message),
        updatedAt: serverTimestamp(),
      });
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Order #{dispute.orderNumber}
            </CardTitle>
            <Badge variant={statusVariant[dispute.status] || 'outline'}>
              {dispute.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {createdDate ? format(createdDate, 'd MMM yyyy') : '-'}
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
                    {s.charAt(0).toUpperCase() + s.slice(1)}
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
