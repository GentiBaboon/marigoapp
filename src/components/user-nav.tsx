
'use client';

import React, { useState } from 'react';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
  ShoppingCart,
  Bell,
  Globe,
  Coins
} from 'lucide-react';
import { useCurrency, type Currency } from '@/context/CurrencyContext';
import { useTranslation, type Locale } from '@/context/LanguageContext';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import type { FirestoreUser } from '@/lib/types';
import { LanguageSwitcher } from './LanguageSwitcher';


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
  const firestore = useFirestore();
  const router = useRouter();
  const { currency, setCurrency } = useCurrency();
  const { t } = useTranslation();

  const userRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: firestoreUser } = useDoc<FirestoreUser>(userRef);

  const [totalUnread, setTotalUnread] = React.useState(0);
  React.useEffect(() => {
    if (!user || !firestore) return;
    const q = query(
      collection(firestore, 'conversations'),
      where('participants', 'array-contains', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const count = snap.docs.reduce((sum, d) => {
        const data = d.data();
        return sum + ((data.unreadCount?.[user.uid] as number) ?? 0);
      }, 0);
      setTotalUnread(count);
    }, () => {
      // Silently ignore permission errors — badge shows 0
    });
    return () => unsubscribe();
  }, [user, firestore]);

  const handleSignOut = async () => {
    await signOutUser(auth);
    router.push('/');
  };

  if (isUserLoading) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <Button asChild variant="outline" size="sm">
            <Link href="/auth">{t('auth.signIn')}</Link>
        </Button>
      </div>
    );
  }

  const displayName = firestoreUser?.name || user.displayName || 'User';
  const displayImage = firestoreUser?.profileImage || user.photoURL || '';

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:block">
        <LanguageSwitcher />
      </div>
      
      <Button asChild variant="ghost" size="icon" aria-label="Notifications">
        <Link href="/notifications">
          <Bell className="h-6 w-6" />
        </Link>
      </Button>

      <Button asChild variant="ghost" size="icon" aria-label="Messages" className="relative">
        <Link href="/messages">
          <MessageSquare className="h-6 w-6" />
          {totalUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </Link>
      </Button>

      <Button asChild variant="ghost" size="icon" aria-label="Shopping Cart" className="relative">
        <Link href="/cart">
          <ShoppingCart className="h-6 w-6" />
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={displayImage}
                alt={displayName}
              />
              <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80" align="end" forceMount>
          <DropdownMenuLabel className="font-serif text-3xl font-normal py-3 truncate">
            {displayName}
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

          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider px-2 py-1.5">
              Buying
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href="/profile/orders">Orders</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/profile/offers">My Offers</Link>
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
              <Link href="/sell">Sell an item</Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />

          <DropdownMenuGroup className="sm:hidden">
             <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider px-2 py-1.5">
              Language
            </DropdownMenuLabel>
            <LanguageSwitcher />
            <DropdownMenuSeparator />
          </DropdownMenuGroup>

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

          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider flex items-center px-2 py-1.5">
            <Coins className="mr-2 h-3.5 w-3.5" />
            Currency
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
              <DropdownMenuRadioItem value="EUR" className="cursor-pointer">Euro (EUR)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="USD" className="cursor-pointer">US Dollar (USD)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="ALL" className="cursor-pointer">Albanian Lek (ALL)</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
