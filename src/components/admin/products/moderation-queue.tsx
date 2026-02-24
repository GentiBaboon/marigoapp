'use client';
import * as React from 'react';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2 } from 'lucide-react';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { FirestoreProduct, FirestoreUser } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

// Helper component to fetch and display seller name
const SellerInfo = ({ sellerId }: { sellerId: string }) => {
    const firestore = useFirestore();
    const sellerRef = useMemoFirebase(() => doc(firestore, 'users', sellerId), [firestore, sellerId]);
    const { data: seller, isLoading } = useDoc<FirestoreUser>(sellerRef);

    if (isLoading) {
        return <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-24" />
        </div>;
    }
    
    if (!seller) return null;

    const getInitials = (name?: string | null) => {
        if (!name) return 'S';
        const names = name.split(' ');
        return names.length > 1
            ? `${names[0][0]}${names[names.length - 1][0]}`
            : name.substring(0, 2);
    };

    return (
        <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
                <AvatarImage src={seller.photoURL ?? undefined} />
                <AvatarFallback>{getInitials(seller.displayName)}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{seller.displayName}</span>
        </div>
    );
}

interface ModerationCardProps {
  product: FirestoreProduct;
}

const ModerationCard: React.FC<ModerationCardProps> = ({ product }) => {
  const firestore = useFirestore();
  const { user: adminUser } = useUser();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState<null | 'approve' | 'reject'>(null);

  const handleUpdateStatus = async (status: 'active' | 'rejected') => {
    if (!adminUser) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in as an admin.'});
        return;
    }
    setIsLoading(status === 'active' ? 'approve' : 'reject');
    const productRef = doc(firestore, 'products', product.id);
    const logCollectionRef = collection(firestore, 'admin_logs');

    try {
      // Update product status
      await updateDoc(productRef, { status: status });

      // Create admin log entry
      await addDoc(logCollectionRef, {
          adminId: adminUser.uid,
          adminName: adminUser.displayName || 'Admin',
          actionType: status === 'active' ? 'product_approved' : 'product_rejected',
          details: `${status === 'active' ? 'Approved' : 'Rejected'} product "${product.title}" (ID: ${product.id})`,
          targetId: product.id,
          timestamp: serverTimestamp()
      });

      toast({
        title: `Product ${status}`,
        description: `The product "${product.title}" has been ${status}.`,
      });
    } catch (error) {
      console.error(`Error updating product status:`, error);
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: 'Could not update the product status.',
      });
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle>{product.title}</CardTitle>
                <CardDescription>{product.brand}</CardDescription>
            </div>
            <SellerInfo sellerId={product.sellerId} />
        </div>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-6">
        <div className="relative aspect-[4/3] bg-muted rounded-md overflow-hidden">
            <Image 
                src={product.images?.[0] || '/placeholder.png'} 
                alt={product.title} 
                fill 
                className="object-cover" 
                sizes="(max-width: 768px) 100vw, 50vw"
            />
        </div>
        <div className="space-y-4">
            <div>
                <h4 className="font-semibold">Description</h4>
                <p className="text-sm text-muted-foreground">{product.description}</p>
            </div>
            <div>
                <h4 className="font-semibold">Details</h4>
                <div className="text-sm space-y-1 mt-1">
                    <p><span className="text-muted-foreground">Category:</span> {product.category}</p>
                    <p><span className="text-muted-foreground">Condition:</span> {product.condition}</p>
                    <p><span className="text-muted-foreground">Price:</span> {currencyFormatter.format(product.price)}</p>
                </div>
            </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => handleUpdateStatus('rejected')} disabled={!!isLoading}>
          {isLoading === 'reject' ? 'Rejecting...' : <><X className="mr-2 h-4 w-4" /> Reject</>}
        </Button>
        <Button size="sm" onClick={() => handleUpdateStatus('active')} disabled={!!isLoading}>
          {isLoading === 'approve' ? 'Approving...' : <><Check className="mr-2 h-4 w-4" /> Approve</>}
        </Button>
      </CardFooter>
    </Card>
  );
};

interface ModerationQueueProps {
  products: FirestoreProduct[];
}

export const ModerationQueue: React.FC<ModerationQueueProps> = ({ products }) => {
  if (products.length === 0) {
    return (
      <div className="text-center py-10 border-2 border-dashed rounded-lg">
        <h3 className="text-lg font-semibold">Queue is empty</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          No products are currently waiting for moderation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {products.map((product) => (
        <ModerationCard key={product.id} product={product} />
      ))}
    </div>
  );
};
