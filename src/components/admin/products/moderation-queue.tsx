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
import { Check, X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { FirestoreProduct } from '@/lib/types';

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

interface ModerationCardProps {
  product: FirestoreProduct;
}

const ModerationCard: React.FC<ModerationCardProps> = ({ product }) => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState<null | 'approve' | 'reject'>(null);

  const handleUpdateStatus = async (status: 'active' | 'rejected') => {
    setIsLoading(status === 'active' ? 'approve' : 'reject');
    const productRef = doc(firestore, 'products', product.id);
    try {
      await updateDoc(productRef, { status: status });
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
        <CardTitle>{product.title}</CardTitle>
        <CardDescription>{product.brand}</CardDescription>
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
