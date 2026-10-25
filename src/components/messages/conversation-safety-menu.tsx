'use client';

import * as React from 'react';
import { Ban, Flag, MoreVertical, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ReportMemberDialog } from './report-member-dialog';
import type { MemberBlock } from './use-member-block';

interface ConversationSafetyMenuProps {
  member: { userId: string; name: string };
  conversationId: string;
  memberBlock: MemberBlock;
}

/**
 * Report and Block for a buyer↔seller thread (App Store guideline 1.2).
 * Rendered in the chat header only where `canReportOrBlock()` allows it.
 */
export function ConversationSafetyMenu({ member, conversationId, memberBlock }: ConversationSafetyMenuProps) {
  const { toast } = useToast();
  const [reportOpen, setReportOpen] = React.useState(false);
  const [blockOpen, setBlockOpen] = React.useState(false);

  const block = async () => {
    await memberBlock.block(conversationId);
  };

  const confirmBlock = async () => {
    try {
      await block();
      toast({ title: `${member.name} is blocked`, description: 'Neither of you can send messages in this conversation now.' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not block', description: 'Please try again.' });
    }
  };

  const unblock = async () => {
    try {
      await memberBlock.unblock();
      toast({ title: `${member.name} is unblocked` });
    } catch {
      toast({ variant: 'destructive', title: 'Could not unblock', description: 'Please try again.' });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="ml-1 flex-shrink-0" aria-label="Conversation options">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setReportOpen(true)}>
            <Flag className="mr-2 h-4 w-4" />
            Report {member.name}
          </DropdownMenuItem>
          {memberBlock.isBlocked ? (
            <DropdownMenuItem onSelect={unblock}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Unblock {member.name}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setBlockOpen(true)} className="text-destructive focus:text-destructive">
              <Ban className="mr-2 h-4 w-4" />
              Block {member.name}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportMemberDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        member={member}
        conversationId={conversationId}
        onBlock={memberBlock.isBlocked ? undefined : block}
      />

      <AlertDialog open={blockOpen} onOpenChange={setBlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {member.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They won&apos;t be able to message you or start a new conversation with you, and you won&apos;t be able
              to message them. They won&apos;t be told. You can unblock them from this conversation at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBlock} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
