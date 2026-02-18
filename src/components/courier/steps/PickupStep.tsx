'use client';
import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { FirestoreDelivery } from '@/lib/types';
import { MapPin, Navigation, Package, User, Phone, Info } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface PickupStepProps {
  delivery: FirestoreDelivery;
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

export function PickupStep({ delivery }: PickupStepProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const pickupAddress = `${delivery.addresses.pickup.address}, ${delivery.addresses.pickup.city}, ${delivery.addresses.pickup.postal}`;
  const deliveryAddress = `${delivery.addresses.delivery.address}, ${delivery.addresses.delivery.city}, ${delivery.addresses.delivery.postal}`;

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    pickupAddress
  )}&destination=${encodeURIComponent(deliveryAddress)}`;

  const handleArrived = async () => {
    setIsLoading(true);
    const deliveryRef = doc(firestore, 'deliveries', delivery.id);
    try {
      await updateDoc(deliveryRef, { status: 'arrived_for_pickup' });
      toast({
        title: 'Status Updated',
        description: 'You have arrived at the pickup location.',
      });
    } catch (error) {
      console.error('Failed to update status:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not update your status. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Navigate to Pickup</CardTitle>
          <CardDescription>
            Head to the seller's location to pick up the item.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DetailRow
            icon={MapPin}
            label="Pickup Address"
            value={pickupAddress}
          />
          <DetailRow
            icon={User}
            label="Seller Name"
            value={delivery.addresses.pickup.fullName}
          />
          <DetailRow
            icon={Phone}
            label="Seller Phone"
            value={delivery.addresses.pickup.phone}
          />
          <DetailRow
            icon={Package}
            label="Package Size"
            value={delivery.packageSize}
          />
          {delivery.specialInstructions && (
            <DetailRow
              icon={Info}
              label="Instructions"
              value={delivery.specialInstructions}
            />
          )}

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button asChild className="w-full" size="lg">
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                <Navigation className="mr-2 h-4 w-4" />
                Navigate
              </a>
            </Button>
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={handleArrived}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              I've Arrived at Pickup
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
