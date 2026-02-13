'use client';

import Link from 'next/link';
import { Button } from './ui/button';
import { Bell, Search, ShoppingCart } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export function Header() {
  const { totalItems } = useCart();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container grid h-16 grid-cols-3 items-center px-4">
        {/* Left: Search Icon */}
        <div className="flex justify-start">
          <Button asChild variant="ghost" size="icon" aria-label="Search">
            <Link href="/search">
              <Search className="h-6 w-6" />
            </Link>
          </Button>
        </div>

        {/* Center: Logo */}
        <div className="flex justify-center">
          <Link href="/home" className="font-logo text-3xl font-bold tracking-tight">
            marigo
          </Link>
        </div>

        {/* Right: Notifications & Cart */}
        <div className="flex items-center justify-end gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Notifications">
            <Link href="/notifications">
              <Bell className="h-6 w-6" />
            </Link>
          </Button>
          
          <Button asChild variant="ghost" size="icon" aria-label="Shopping Cart" className="relative">
            <Link href="/cart">
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
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
