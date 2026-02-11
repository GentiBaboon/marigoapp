'use client';

import React, { useState } from 'react';
import { useUser, useAuth } from '@/firebase';
import { signOutUser } from '@/firebase/auth/actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Skeleton } from './ui/skeleton';
import {
  Info,
  Calendar,
  LogOut,
  MessageSquare,
  LifeBuoy,
  Circle,
  CircleDot,
} from 'lucide-react';

const getInitials = (name: string | null | undefined) => {
  if (!name) return 'U';
  const names = name.split(' ');
  if (names.length > 1) {
    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export function UserNav() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const [shoppingPreference, setShoppingPreference] = useState('menswear');

  const handleSignOut = async () => {
    await signOutUser(auth);
    router.push('/');
  };

  if (isUserLoading) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  if (!user) {
    return (
      <Button asChild>
        <Link href="/auth">Sign In</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={user.photoURL || ''}
              alt={user.displayName || 'User'}
            />
            <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end" forceMount>
        <DropdownMenuLabel className="font-serif text-3xl font-normal py-3">
          {user?.displayName}
        </DropdownMenuLabel>

        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/profile">See my profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/profile/settings">Account settings</Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider flex items-center px-2 py-1.5">
          Shopping Preference
          <Info className="ml-1 h-3 w-3" />
        </DropdownMenuLabel>

        <DropdownMenuItem
          onSelect={() => setShoppingPreference('womenswear')}
          className="flex justify-between items-center"
        >
          Womenswear
          {shoppingPreference === 'womenswear' ? <CircleDot /> : <Circle />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => setShoppingPreference('menswear')}
          className="flex justify-between items-center"
        >
          Menswear
          {shoppingPreference === 'menswear' ? <CircleDot /> : <Circle />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider px-2 py-1.5">
            Buying
          </DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href="/profile/orders">Orders</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="#">Buying offers</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="#">Saved searches</Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider px-2 py-1.5">
            Selling
          </DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href="/profile/listings">Listings</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="#">Selling offers</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="#">Sales</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="#">Get paid</Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Vacation mode</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider px-2 py-1.5">
            Support
          </DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href="/messages" className="flex items-center">
              <MessageSquare className="mr-2 h-4 w-4" />
              <span>Chat with us</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/help" className="flex items-center">
              <LifeBuoy className="mr-2 h-4 w-4" />
              <span>Help center</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuItem disabled>
          <span role="img" aria-label="Italian flag" className="mr-2">
            🇮🇹
          </span>
          <span>Italy (€ EUR) • English UK</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
