import Link from 'next/link';
import { Button } from './ui/button';
import { Bell, ShoppingCart } from 'lucide-react';
import { UserNav } from '@/components/user-nav';


export function Header() {

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <div className="flex gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            <span className="inline-block font-logo font-bold text-2xl bg-gradient-to-r from-primary to-purple-400 text-transparent bg-clip-text">
              marigo
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-1">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Shopping Cart">
              <ShoppingCart className="h-5 w-5" />
            </Button>
            <UserNav />
          </nav>
        </div>
      </div>
    </header>
  );
}
