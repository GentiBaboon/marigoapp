'use client';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { FirestoreDelivery } from '@/lib/types';
import { useParams, useRouter } from 'next/navigation';
import { PickupStep } from '@/components/courier/steps/PickupStep';
import { ConfirmPickupStep } from '@/components/courier/steps/ConfirmPickupStep';
import DeliveryLoading from './loading';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function ActiveDeliveryPage() {
  const params = useParams();
  const router = useRouter();
  const deliveryId = params.deliveryId as string;
  const firestore = useFirestore();

  const deliveryRef = useMemoFirebase(() => {
    if (!firestore || !deliveryId) return null;
    return doc(firestore, 'deliveries', deliveryId);
  }, [firestore, deliveryId]);

  const { data: delivery, isLoading } = useDoc<FirestoreDelivery>(deliveryRef);

  if (isLoading) {
    return <DeliveryLoading />;
  }

  if (!delivery) {
    return <div>Delivery not found or you don't have access.</div>;
  }

  const renderStep = () => {
    switch (delivery.status) {
      case 'assigned':
        return <PickupStep delivery={delivery} />;
      case 'arrived_for_pickup':
        return <ConfirmPickupStep delivery={delivery} />;
      // TODO: Add other steps
      // case 'picked_up':
      //     return <NavigateToDeliveryStep delivery={delivery} />;
      // case 'arrived_for_delivery':
      //     return <ConfirmDeliveryStep delivery={delivery} />;
      case 'delivered':
        return <div>Delivery Completed!</div>;
      case 'cancelled':
        return <div>Delivery Cancelled.</div>;
      default:
        return <div>Unknown delivery status: {delivery.status}</div>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/courier/dashboard')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Active Delivery</h1>
          <p className="text-muted-foreground">
            Order #{delivery.orderId.slice(0, 8)}...
          </p>
        </div>
      </div>
      {renderStep()}
    </div>
  );
}
