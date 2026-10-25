'use client';

import * as React from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { REPORT_DETAILS_MAX, REPORT_REASONS, buildUserReport, type ReportReason } from '@/lib/moderation';

interface ReportMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: { userId: string; name: string };
  conversationId?: string;
  /** When given, the dialog offers to block as well. Omit if already blocked. */
  onBlock?: () => Promise<void>;
}

export function ReportMemberDialog({ open, onOpenChange, member, conversationId, onBlock }: ReportMemberDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [reason, setReason] = React.useState<ReportReason | ''>('');
  const [details, setDetails] = React.useState('');
  const [alsoBlock, setAlsoBlock] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setReason('');
      setDetails('');
      setAlsoBlock(false);
    }
  }, [open]);

  const submit = async () => {
    if (!user || !firestore || !reason) return;
    setIsSending(true);
    try {
      const report = buildUserReport({
        reporterId: user.uid,
        reportedUserId: member.userId,
        conversationId,
        reason,
        details,
      });
      await addDoc(collection(firestore, 'reports'), { ...report, createdAt: serverTimestamp() });
      if (alsoBlock && onBlock) await onBlock();
      onOpenChange(false);
      toast({
        title: 'Report sent',
        description: alsoBlock
          ? `Thanks for telling us. ${member.name} is blocked and can no longer message you.`
          : 'Thanks for telling us. The Marigo team will review this conversation.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not send the report',
        description: error?.message && !String(error.message).includes('permission')
          ? error.message
          : 'Please try again, or write to hello@marigoapp.com.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Capped and scrolling: seven reasons plus the text box outgrow a
          phone in landscape, and Radix dialogs do not scroll on their own. */}
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report {member.name}</DialogTitle>
          <DialogDescription>
            Reports are private. {member.name} won&apos;t be told who sent it. The Marigo team reviews the
            conversation and can remove messages or suspend the account.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReportReason)} className="gap-1">
          {REPORT_REASONS.map((r) => (
            <Label
              key={r.value}
              htmlFor={`report-${r.value}`}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 font-normal hover:bg-muted"
            >
              <RadioGroupItem id={`report-${r.value}`} value={r.value} />
              {r.label}
            </Label>
          ))}
        </RadioGroup>

        <div className="space-y-1.5">
          <Label htmlFor="report-details">What happened? (optional)</Label>
          {/* text-base: below 16px iOS zooms the page when the field takes focus. */}
          <Textarea
            id="report-details"
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, REPORT_DETAILS_MAX))}
            rows={3}
            className="text-base md:text-sm"
            placeholder="Anything that helps us understand"
          />
        </div>

        {onBlock && (
          <Label htmlFor="report-also-block" className="flex cursor-pointer items-center gap-3 font-normal">
            <Checkbox id="report-also-block" checked={alsoBlock} onCheckedChange={(v) => setAlsoBlock(v === true)} />
            Also block {member.name}
          </Label>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={!reason || isSending}>
            {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
