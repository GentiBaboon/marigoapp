'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Star, X } from 'lucide-react';
import { MarigoVIcon } from '../icons/MarigoVIcon';
import { usePathname } from 'next/navigation';

const SESSION_STORAGE_KEY = 'marigo_app_banner_shown';

export function DownloadAppBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const handleScroll = useCallback(() => {
    // Only show banner on scrollable pages, not on checkout, auth, etc.
    const forbiddenPaths = ['/cart', '/checkout', '/auth', '/sell', '/profile', '/messages'];
    if (forbiddenPaths.some(p => pathname.startsWith(p))) return;
    
    // Don't show the banner if it has already been shown in this session
    if (sessionStorage.getItem(SESSION_STORAGE_KEY)) {
      return;
    }
    
    setIsOpen(true);
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
  }, [pathname]);

  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;

    const scrollListener = () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(handleScroll, 5000);
    };

    window.addEventListener('scroll', scrollListener);

    return () => {
      clearTimeout(scrollTimeout);
      window.removeEventListener('scroll', scrollListener);
    };
  }, [handleScroll]);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent
        side="bottom"
        className="h-auto rounded-t-lg border-t-0 bg-background shadow-2xl p-4 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
        hideClose // Hide the default close button
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Download Marigo App</SheetTitle>
        </SheetHeader>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-1 right-0 h-7 w-7"
            onClick={handleClose}
          >
            <X className="h-5 w-5 text-muted-foreground" />
            <span className="sr-only">Close</span>
          </Button>

          <div className="flex items-center gap-4">
            <MarigoVIcon className="h-12 w-12 flex-shrink-0" />
            <div>
              <h3 className="font-semibold">Shop Exclusive Deals on our App</h3>
              <div className="flex items-center gap-1">
                <div className="flex text-yellow-400">
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                </div>
                <span className="text-xs text-muted-foreground">(45k)</span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Save extra with special discounts, custom offers, price drop alerts,
            and more.
          </p>
          <Button
            size="lg"
            className="w-full mt-4 bg-foreground text-background hover:bg-foreground/90"
          >
            Get the app
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
