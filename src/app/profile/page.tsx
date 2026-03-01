'use client';

import React, { useEffect, useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
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
  Handshake,
  Landmark,
  Truck,
  LayoutDashboard,
  ShieldAlert
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { FirestoreUser } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { EditProfileForm } from '@/components/profile/edit-profile-form';

const getInitials = (name: string | null | undefined) => {
  if (!name) return 'U';
  const names = name.split(' ');
  if (names.length > 1) {
    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function ProfilePage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const userRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: firestoreUser } = useDoc<FirestoreUser>(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/auth');
    }
  }, [user, isUserLoading, router]);

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

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="dot-flashing"></div>
      </div>
    );
  }

  const role = firestoreUser?.role || 'buyer';
  const isAdmin = role === 'admin';
  const isSeller = role === 'seller' || isAdmin;
  const isCourier = role === 'courier';

  const menuItems = [
    ...(isAdmin ? [{ href: '/admin', label: 'Admin Dashboard', icon: ShieldAlert }] : []),
    { href: '/profile/orders', label: 'My Orders', icon: Package },
    { href: '/profile/listings', label: 'My Listings', icon: Tag },
    { href: '/profile/offers', label: 'My Offers', icon: Handshake },
    { href: '/profile/stripe-onboarding', label: 'Setup Payouts (Sellers)', icon: Landmark },
    ...(isCourier ? [{ href: '/courier/dashboard', label: 'Courier Dashboard', icon: LayoutDashboard }] : []),
    ...(role === 'buyer' ? [{ href: '/delivery-partner', label: 'Become a Delivery Partner', icon: Truck }] : []),
    { href: '/sell', label: 'Sell an Item', icon: null, special: true },
    { href: '/profile/addresses', label: 'My Addresses', icon: MapPin },
    { href: '/profile/payments', label: 'Payment Methods', icon: CreditCard },
    { href: '/profile/settings', label: 'Settings', icon: Settings },
  ];

  const helpMenuItems = [
    { href: '/help', label: 'Help Center', icon: HelpCircle },
    { href: '/about', label: 'About Marigo', icon: Info },
  ];

  const displayName = firestoreUser?.name || user.displayName || 'Marigo User';
  const displayImage = firestoreUser?.profileImage || user.photoURL || '';

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
      <div className="space-y-8">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-center gap-4">
            <Avatar className="h-16 w-16 text-2xl">
              <AvatarImage
                src={displayImage}
                alt={displayName}
              />
              <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left">
              <CardTitle className="font-headline text-2xl">
                {displayName}
              </CardTitle>
              <CardDescription>{user.email}</CardDescription>
              {firestoreUser?.role && (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                      {firestoreUser.role}
                  </span>
              )}
            </div>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="sm:ml-auto w-full sm:w-auto">
                      Edit Profile
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Profile</DialogTitle>
                        <DialogDescription>
                            Update your name and phone number to keep your profile current.
                        </DialogDescription>
                    </DialogHeader>
                    <EditProfileForm onSuccess={() => setIsEditDialogOpen(false)} />
                </DialogContent>
            </Dialog>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="p-2">
            <nav>
              <ul>
                {menuItems.map((item, index) => {
                  if (item.special) {
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
                        <span className="flex-1 font-medium">
                          {item.label}
                        </span>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </Link>
                      {index < menuItems.length - 1 && !menuItems[index + 1]?.special && (
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
                      <span className="flex-1 font-medium">
                        {item.label}
                      </span>
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
