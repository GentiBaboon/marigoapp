'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ChatRulesDialogProps {
  isOpen: boolean;
  onAccept: () => void;
  onOpenChange: (isOpen: boolean) => void;
}

export function ChatRulesDialog({ isOpen, onAccept, onOpenChange }: ChatRulesDialogProps) {

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">Chat rules</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <p className="text-muted-foreground text-center">
            To keep our community safe, we require that all members follow the chat rules against:
          </p>
          <ul className="space-y-4 text-sm">
            <li className="flex flex-col">
              <span className="font-semibold flex items-center">
                <span className="mr-2 text-lg">▪</span> Exchanging personal information:
              </span>
              <span className="text-muted-foreground ml-5">
                Financial info, addresses, phone numbers, or social media handles.
              </span>
            </li>
            <li className="flex flex-col">
              <span className="font-semibold flex items-center">
                 <span className="mr-2 text-lg">▪</span> Dealing on other platforms:
              </span>
              <span className="text-muted-foreground ml-5">
                Inquiries about chatting externally or sending links.
              </span>
            </li>
            <li className="flex flex-col">
              <span className="font-semibold flex items-center">
                 <span className="mr-2 text-lg">▪</span> Spamming:
              </span>
              <span className="text-muted-foreground ml-5">
                Repetitive messaging.
              </span>
            </li>
            <li className="flex flex-col">
              <span className="font-semibold flex items-center">
                 <span className="mr-2 text-lg">▪</span> Acting threatening or inappropriate:
              </span>
              <span className="text-muted-foreground ml-5">
                Hate speech, sexual material, or profanity.
              </span>
            </li>
          </ul>
          <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-900">
            <AlertDescription className="text-center text-sm">
              Failure to comply with these rules can result in a <span className="font-bold">permanent ban</span> from the chat.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button type="button" className="w-full bg-black text-white hover:bg-black/90" onClick={onAccept}>
            Accept rules
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
