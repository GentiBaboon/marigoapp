'use client';
import Link from 'next/link';
import { Home, ShoppingCart, User, Search, PlusCircle } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { useCart } from '@/context/CartContext';

export function MobileNav() {
    const pathname = usePathname();
    const { user, isUserLoading } = useUser();
    const { totalItems } = useCart();
    const router = useRouter();

    const navItems = [
        { href: '/home', label: "Home", icon: Home, requiresAuth: false },
        { href: '/browse', label: "Shop", icon: Search, requiresAuth: false },
        { href: '/sell', label: "Sell", icon: PlusCircle, requiresAuth: true },
        // ShoppingCart matches the header's cart control, so the same action
        // reads as the same thing in both places.
        { href: '/cart', label: "Cart", icon: ShoppingCart, requiresAuth: true },
        { href: '/profile', label: "Me", icon: User, requiresAuth: true },
    ];
  
  // h-16 is the tappable row; the safe-area padding sits *below* it (box-content
  // keeps it additive) so the icons clear the home indicator instead of being
  // crossed by it, while the bar's background still fills to the bottom edge.
  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 box-content pb-safe-bottom pl-safe-left pr-safe-right bg-background border-t md:hidden">
      <div className="grid h-full max-w-lg grid-cols-5 mx-auto">
        {navItems.map(item => {
            // Native serves "/home/", so an exact === comparison never matched
            // and the Home tab never highlighted on device. Strip the trailing
            // slash before comparing, as the header does.
            const path = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
            const isActive =
              item.href === '/home'
                ? path === '/home'
                : path === item.href || path.startsWith(item.href + '/');
            return (
                <Link
                    key={item.label}
                    href={item.href}
                    onClick={(e) => {
                        if (item.requiresAuth && !isUserLoading && !user) {
                            e.preventDefault();
                            router.push('/auth');
                        }
                    }}
                    className="inline-flex flex-col items-center justify-center px-1 text-center hover:bg-muted group"
                >
                    <span className="relative mb-1">
                      <item.icon className={cn("w-6 h-6 text-muted-foreground group-hover:text-primary", isActive && "text-primary")} />
                      {/* A cart tab with no count makes people open it to find
                          out whether anything is in it. Mirrors the header badge. */}
                      {item.href === '/cart' && totalItems > 0 && (
                        <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                          {totalItems > 99 ? '99+' : totalItems}
                        </span>
                      )}
                    </span>
                    <span className={cn("text-xs text-muted-foreground group-hover:text-primary", isActive && "text-primary")}>
                        {item.label}
                    </span>
                </Link>
            )
        })}
      </div>
    </div>
  );
}
