'use client';
import Link from 'next/link';
import { Home, Heart, PlusCircle, Bell, User } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';


export function MobileNav() {
    const pathname = usePathname();
    const navItems = [
        { href: '/home', label: 'Home', icon: Home },
        { href: '/favorites', label: 'Favourites', icon: Heart },
        { href: '/sell', label: 'Sell now', icon: PlusCircle },
        { href: '/notifications', label: 'Notifications', icon: Bell },
        { href: '/profile', label: 'Me', icon: User },
    ];
  
  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-background border-t md:hidden">
      <div className="grid h-full max-w-lg grid-cols-5 mx-auto">
        {navItems.map(item => {
            const isActive = pathname === item.href;
            return (
                <Link
                    key={item.label}
                    href={item.href}
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

    