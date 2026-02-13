'use client';
import Link from 'next/link';
import { Home, Heart, User, Search, PlusCircle } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';


export function MobileNav() {
    const pathname = usePathname();
    const { user, isUserLoading } = useUser();
    const router = useRouter();

    const navItems = [
        { href: '/home', label: 'Home', icon: Home, requiresAuth: false },
        { href: '/browse', label: 'Shop', icon: Search, requiresAuth: false },
        { href: '/sell', label: 'Sell', icon: PlusCircle, requiresAuth: true },
        { href: '/favorites', label: 'Favorites', icon: Heart, requiresAuth: true },
        { href: '/profile', label: 'Me', icon: User, requiresAuth: true },
    ];
  
  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-background border-t md:hidden">
      <div className="grid h-full max-w-lg grid-cols-5 mx-auto">
        {navItems.map(item => {
            const isActive = (item.href === '/home' && pathname === '/home') || (item.href !== '/home' && pathname.startsWith(item.href));
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
                    <item.icon className={cn("w-6 h-6 mb-1 text-muted-foreground group-hover:text-primary", isActive && "text-primary")} />
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
