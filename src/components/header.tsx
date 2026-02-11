
'use client';

import Link from 'next/link';
import { Button } from './ui/button';
import { Menu, ShoppingCart } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export function Header() {
  const { totalItems } = useCart();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container grid h-16 grid-cols-3 items-center px-4">
        <div className="flex justify-start">
          <Button variant="ghost" size="icon" aria-label="Menu">
            <Menu className="h-6 w-6" />
          </Button>
        </div>
        <div className="flex justify-center">
          <Link href="/home" className="text-xl font-bold font-serif tracking-wide">
            Vestiaire Collective
          </Link>
        </div>
        <div className="flex justify-end">
          <Button asChild variant="ghost" size="icon" aria-label="Shopping Cart" className="relative">
            <Link href="/cart">
              {totalItems > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
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

    