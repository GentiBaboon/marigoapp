'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';
import { Button } from './ui/button';
import { Bell, Search, ShoppingCart, ArrowLeft } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { Skeleton } from './ui/skeleton';

function HeaderContent() {
  const { totalItems } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const topLevelNavPaths = [
    '/home',
    '/browse',
    '/favorites',
    '/profile',
    '/sell',
  ];

  const isSearchBasePage = pathname === '/search' && searchParams.toString().length === 0;
  const isRootPage = pathname === '/';
  
  const isTopLevelPage = topLevelNavPaths.includes(pathname) || isSearchBasePage || isRootPage;

  const showBackArrow = !isTopLevelPage;

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container grid h-16 grid-cols-3 items-center px-4">
        <div className="flex justify-start">
          {showBackArrow ? (
            <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => router.back()}>
              <ArrowLeft className="h-6 w-6" />
            </Button>
          ) : (
            <Button asChild variant="ghost" size="icon" aria-label="Search">
              <Link href="/search">
                <Search className="h-6 w-6" />
              </Link>
            </Button>
          )}
        </div>
        
        <div className="flex justify-center">
          <Link href="/home" className="font-logo text-3xl font-bold tracking-tight">
            marigo
          </Link>
        </div>

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

function HeaderSkeleton() {
    return (
        <header className="sticky top-0 z-40 w-full border-b bg-background">
            <div className="container grid h-16 grid-cols-3 items-center px-4">
                <div className="flex justify-start">
                    <Skeleton className="h-10 w-10" />
                </div>
                <div className="flex justify-center">
                    <Link href="/home" className="font-logo text-3xl font-bold tracking-tight">
                        marigo
                    </Link>
                </div>
                <div className="flex items-center justify-end gap-2">
                    <Skeleton className="h-10 w-10" />
                    <Skeleton className="h-10 w-10" />
                </div>
            </div>
        </header>
    )
}

export function Header() {
    return (
        <React.Suspense fallback={<HeaderSkeleton />}>
            <HeaderContent />
        </React.Suspense>
    )
}
