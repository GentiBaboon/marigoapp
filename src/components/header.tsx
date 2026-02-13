'use client';

import Link from 'next/link';
import { Button } from './ui/button';
import { Bell, Search, ShoppingCart } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';

export function Header() {
  const { totalItems } = useCart();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-16 items-center gap-2 px-4">
        <div className="flex-none">
          <Button asChild variant="ghost" size="icon" aria-label="Notifications">
            <Link href="/notifications">
              <Bell className="h-6 w-6" />
            </Link>
          </Button>
        </div>

        <div className="flex-1" onClick={() => router.push('/search')}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <div
              role="button"
              className="h-10 w-full rounded-full bg-muted pl-11 pr-4 flex items-center text-muted-foreground text-sm cursor-pointer"
            >
              Search for items, members...
            </div>
          </div>
        </div>

        <div className="flex-none">
          <Button asChild variant="ghost" size="icon" aria-label="Shopping Cart" className="relative">
            <Link href="/cart">
              {totalItems > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                  {totalItems}
                </span>
              )}
              <ShoppingCart className="h-6 w-6" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
