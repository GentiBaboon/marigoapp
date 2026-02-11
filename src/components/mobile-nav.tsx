import Link from 'next/link';
import { Home, Search, ShoppingCart, Heart, User } from 'lucide-react';

export function MobileNav() {
  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-background border-t md:hidden">
      <div className="grid h-full max-w-lg grid-cols-5 mx-auto">
        <Link
          href="/"
          className="inline-flex flex-col items-center justify-center px-5 hover:bg-muted group"
        >
          <Home className="w-5 h-5 mb-1 text-muted-foreground group-hover:text-primary" />
          <span className="text-xs text-muted-foreground group-hover:text-primary">
            Home
          </span>
        </Link>
        <Link
          href="/search"
          className="inline-flex flex-col items-center justify-center px-5 hover:bg-muted group"
        >
          <Search className="w-5 h-5 mb-1 text-muted-foreground group-hover:text-primary" />
          <span className="text-xs text-muted-foreground group-hover:text-primary">
            Search
          </span>
        </Link>
        <Link
          href="/cart"
          className="inline-flex flex-col items-center justify-center px-5 hover:bg-muted group"
        >
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
