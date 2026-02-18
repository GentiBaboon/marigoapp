'use client';
import Link from 'next/link';
import {
  LayoutDashboard,
  Briefcase,
  CircleDollarSign,
  User,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function CourierNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/courier/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/courier/jobs', label: 'Jobs', icon: Briefcase },
    { href: '/courier/earnings', label: 'Earnings', icon: CircleDollarSign },
    { href: '/courier/profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-background border-t md:hidden">
      <div className="grid h-full max-w-lg grid-cols-4 mx-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className="inline-flex flex-col items-center justify-center px-1 text-center hover:bg-muted group"
            >
              <item.icon
                className={cn(
                  'w-6 h-6 mb-1 text-muted-foreground group-hover:text-primary',
                  isActive && 'text-primary'
                )}
              />
              <span
                className={cn(
                  'text-xs text-muted-foreground group-hover:text-primary',
                  isActive && 'text-primary'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
