'use client';
import Link from 'next/link';
import { Home, MessageSquare, ShoppingCart, Heart, User } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export function MobileNav() {
  const { totalItems } = useCart();
  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-background border-t md:hidden">
      <div className="grid h-full max-w-lg grid-cols-5 mx-auto">
        <Link
          href="/home"
          className="inline-flex flex-col items-center justify-center px-5 hover:bg-muted group"
        >
          <Home className="w-5 h-5 mb-1 text-muted-foreground group-hover:text-primary" />
          <span className="text-xs text-muted-foreground group-hover:text-primary">
            Home
          </span>
        </Link>
        <Link
          href="/messages"
          className="inline-flex flex-col items-center justify-center px-5 hover:bg-muted group"
        >
          <MessageSquare className="w-5 h-5 mb-1 text-muted-foreground group-hover:text-primary" />
          <span className="text-xs text-muted-foreground group-hover:text-primary">
            Messages
          </span>
        </Link>
        <Link
          href="/cart"
          className="relative inline-flex flex-col items-center justify-center px-5 hover:bg-muted group"
        >
          {totalItems > 0 && (
            <span className="absolute top-1 right-3 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {totalItems}
            </span>
          )}
          <ShoppingCart className="w-5 h-5 mb-1 text-muted-foreground group-hover:text-primary" />
          <span className="text-xs text-muted-foreground group-hover:text-primary">
            Cart
          </span>
        </Link>
        <Link
          href="/favorites"
          className="inline-flex flex-col items-center justify-center px-5 hover:bg-muted group"
        >
          <Heart className="w-5 h-5 mb-1 text-muted-foreground group-hover:text-primary" />
          <span className="text-xs text-muted-foreground group-hover:text-primary">
            Favorites
          </span>
        </Link>
        <Link
          href="/profile"
          className="inline-flex flex-col items-center justify-center px-5 hover:bg-muted group"
        >
          <User className="w-5 h-5 mb-1 text-muted-foreground group-hover:text-primary" />
          <span className="text-xs text-muted-foreground group-hover:text-primary">
            Profile
          </span>
        </Link>
      </div>
    </div>
  );
}
