'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useAuth } from '@/firebase';
import { signOutUser } from '@/firebase/auth/actions';
import {
  Settings,
  CreditCard,
  MapPin,
  Tag,
  Package,
  HelpCircle,
  Info,
  ChevronRight,
  LogIn,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const getInitials = (name: string | null | undefined) => {
  if (!name) return 'U';
  const names = name.split(' ');
  if (names.length > 1) {
    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const menuItems = [
  { href: '/profile/orders', label: 'My Orders', icon: Package },
  { href: '/profile/listings', label: 'My Listings', icon: Tag },
  { href: '/sell', label: 'Sell an Item', icon: null }, // special case
  { href: '/profile/addresses', label: 'My Addresses', icon: MapPin },
  { href: '/profile/payments', label: 'Payment Methods', icon: CreditCard },
  { href: '/profile/settings', label: 'Settings', icon: Settings },
];

const helpMenuItems = [
  { href: '/help', label: 'Help Center', icon: HelpCircle },
  { href: '/about', label: 'About Marigo', icon: Info },
];

export default function ProfilePage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignOut = async () => {
    const result = await signOutUser(auth);
    if (result.success) {
      router.push('/');
      toast({
        title: 'Signed Out',
        description: 'You have been successfully signed out.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error || 'Failed to sign out.',
      });
    }
  };

  if (isUserLoading) {
    return (
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
        <div className="space-y-8">
          <Card>
            <CardHeader className="flex flex-row items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-60" />
              </div>
            </CardHeader>
          </Card>
          <Card>
            <CardContent className="p-2">
              <div className="space-y-2 p-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2">
              <div className="space-y-2 p-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </CardContent>
          </Card>
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl text-center">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-3xl">My Profile</CardTitle>
            <CardDescription>
              Please sign in to view your profile and manage your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg">
              <Link href="/auth">
                <LogIn className="mr-2 h-5 w-5" />
                Sign In / Sign Up
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
      <div className="space-y-8">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-center gap-4">
            <Avatar className="h-16 w-16 text-2xl">
              <AvatarImage
                src={user.photoURL || ''}
                alt={user.displayName || 'User'}
              />
              <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left">
              <CardTitle className="font-headline text-2xl">
                {user.displayName || 'Marigo User'}
              </CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </div>
            <Button variant="outline" className="sm:ml-auto w-full sm:w-auto">
              Edit Profile
            </Button>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="p-2">
            <nav>
              <ul>
                {menuItems.map((item, index) => {
                    if (item.href === '/sell') {
                      return (
                        <React.Fragment key={item.href}>
                          <Separator />
                          <li>
                            <Button
                              asChild
                              variant="ghost"
                              className="w-full justify-start text-left h-auto py-3 px-4 text-base text-primary hover:text-primary"
                            >
                              <Link href={item.href}>Sell an Item</Link>
                            </Button>
                          </li>
                          <Separator />
                        </React.Fragment>
                      );
                    }
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="flex items-center p-4 hover:bg-muted rounded-md transition-colors"
                        >
                          {item.icon && (
                            <item.icon className="mr-4 h-5 w-5 text-muted-foreground" />
                          )}
                          <span className="flex-1 font-medium">{item.label}</span>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </Link>
                        {index < menuItems.length - 2 &&
                          menuItems[index + 1].href !== '/sell' && (
                            <Separator className="ml-4" />
                          )}
                      </li>
                    );
                  })}
              </ul>
            </nav>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-2">
            <nav>
              <ul>
                {helpMenuItems.map((item, index) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center p-4 hover:bg-muted rounded-md transition-colors"
                    >
                      {item.icon && (
                        <item.icon className="mr-4 h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="flex-1 font-medium">{item.label}</span>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </Link>
                    {index < helpMenuItems.length - 1 && (
                      <Separator className="ml-4" />
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={handleSignOut}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}
