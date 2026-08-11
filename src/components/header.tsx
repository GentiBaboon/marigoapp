'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';
import Image from 'next/image';
import { Logo } from './logo';
import { Button } from './ui/button';
import { Bell, Search, ShoppingCart, ArrowLeft } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { Skeleton } from './ui/skeleton';
import { UserNav } from './user-nav';
import { SearchOverlay } from './search/search-overlay';
import { cn } from '@/lib/utils';

// /browse/{slug} resolves a single segment against top-level CATEGORY slugs,
// so gender links there ("/browse/women") hit "Category not found" — a gender
// landing needs /browse/{gender}/{category}. Genders go to search instead,
// which filters on the schema's gender values and lists everything.
const navLinks = [
    { href: '/search?gender=women', label: 'Women' },
    { href: '/search?gender=men', label: 'Men' },
    { href: '/search?gender=children', label: 'Children' },
    { href: '/browse/clothing', label: 'Clothing' },
    { href: '/browse/bags', label: 'Bags' },
    { href: '/browse/accessories', label: 'Accessories' },
    { href: '/browse/shoes', label: 'Shoes' },
];

function HeaderContent() {
  const { totalItems } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

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
    // `relative` anchors the desktop search dropdown, which hangs off the
    // header's bottom edge via `top-full`. The header's own z-index has to beat
    // the fixed MobileNav's z-50 while the panel is open — the panel is a child
    // of this stacking context, so it can't out-rank the nav on its own.
    <header
      className={cn(
        'sticky top-0 w-full border-b bg-background relative',
        isSearchOpen ? 'z-[60]' : 'z-40',
      )}
    >
      <div className="container flex h-16 md:h-20 items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-4">
          {showBackArrow ? (
            <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => router.back()} className="md:hidden">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search"
              aria-expanded={isSearchOpen}
              onClick={() => setIsSearchOpen(true)}
              className="md:hidden"
            >
              <Search className="h-6 w-6" />
            </Button>
          )}
          {/* shrink-0: the nav beside it is wide enough at the md breakpoint to
              squeeze the auto-width logo down to 0. */}
          <Link href="/home" className="shrink-0">
            {/* h-7 from size="md" holds on mobile; md:h-9 scales it up on
                desktop without a second <Logo> for each breakpoint. */}
            <Logo size="md" priority className="md:h-9" />
          </Link>
          {/* Between md and ~lg the seven links + Sell + icons exceed the row;
              letting the nav scroll keeps every link reachable instead of
              overlapping the actions on the right. */}
          <nav className="hidden md:flex min-w-0 items-center gap-6 lg:gap-8 ml-6 lg:ml-10 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navLinks.map(link => (
                <Link key={link.href} href={link.href} className="whitespace-nowrap text-sm lg:text-base font-medium text-muted-foreground hover:text-primary transition-colors">
                    {link.label}
                </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-shrink-0 items-center justify-end gap-2">
            {/* Desktop only — the bottom MobileNav already carries a Sell entry. */}
            <Button
              asChild
              className="hidden md:inline-flex bg-primary text-white hover:bg-primary/90 rounded-md px-5 font-medium"
            >
              <Link href="/sell">Sell</Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search"
              aria-expanded={isSearchOpen}
              onClick={() => setIsSearchOpen(true)}
              className="hidden md:inline-flex"
            >
              <Search className="h-6 w-6" />
            </Button>
            <UserNav />
        </div>
      </div>

      {isSearchOpen && <SearchOverlay onClose={() => setIsSearchOpen(false)} />}
    </header>
  );
}

function HeaderSkeleton() {
    return (
        <header className="sticky top-0 z-40 w-full border-b bg-background">
            <div className="container grid h-16 md:h-20 grid-cols-3 items-center px-4">
                <div className="flex justify-start">
                    <Skeleton className="h-10 w-10" />
                </div>
                <div className="flex justify-center">
                    <Link href="/home">
                        <Logo size="md" className="md:h-9" />
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
