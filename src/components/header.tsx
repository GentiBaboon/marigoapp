'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';
import { Button } from './ui/button';
import { Bell, Search, ShoppingCart, ArrowLeft } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { Skeleton } from './ui/skeleton';
import { UserNav } from './user-nav';

const navLinks = [
    { href: '/browse/women', label: 'Womenswear' },
    { href: '/browse/men', label: 'Menswear' },
    { href: '/browse/bags', label: 'Bags' },
    { href: '/browse/shoes', label: 'Shoes' },
];

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
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          {showBackArrow ? (
            <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => router.back()} className="md:hidden">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          ) : (
            <Button asChild variant="ghost" size="icon" aria-label="Search" className="md:hidden">
              <Link href="/search">
                <Search className="h-6 w-6" />
              </Link>
            </Button>
          )}
          <Link href="/home" className="font-logo text-3xl font-bold tracking-tight">
            marigo
          </Link>
          <nav className="hidden md:flex items-center gap-6 ml-6">
            {navLinks.map(link => (
                <Link key={link.href} href={link.href} className="text-sm font-medium text-muted-foreground hover:text-primary">
                    {link.label}
                </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center justify-end gap-2">
            <Button asChild variant="ghost" size="icon" aria-label="Search" className="hidden md:inline-flex">
              <Link href="/search">
                <Search className="h-6 w-6" />
              </Link>
            </Button>
            <UserNav />
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
