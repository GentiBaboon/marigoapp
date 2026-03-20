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
      case 'picked_up':
      case 'in_transit':
        return (
          <div className="text-center py-10 space-y-3">
            <div className="text-4xl">🚚</div>
            <h2 className="text-xl font-bold">In Transit</h2>
            <p className="text-muted-foreground">Package picked up. Navigate to the delivery address.</p>
          </div>
        );
      case 'arrived_for_delivery':
        return (
          <div className="text-center py-10 space-y-3">
            <div className="text-4xl">📍</div>
            <h2 className="text-xl font-bold">Arrived at Destination</h2>
            <p className="text-muted-foreground">Please hand the package to the recipient and confirm delivery.</p>
          </div>
        );
      case 'delivered':
        return (
          <div className="text-center py-10 space-y-3">
            <div className="text-4xl">✅</div>
            <h2 className="text-xl font-bold">Delivery Completed!</h2>
            <p className="text-muted-foreground">This delivery has been successfully completed.</p>
          </div>
        );
      case 'cancelled':
        return (
          <div className="text-center py-10 space-y-3">
            <div className="text-4xl">❌</div>
            <h2 className="text-xl font-bold">Delivery Cancelled</h2>
            <p className="text-muted-foreground">This delivery has been cancelled.</p>
          </div>
        );
      default:
        return (
          <div className="text-center py-10 space-y-3">
            <p className="text-muted-foreground">Status: {delivery.status}</p>
          </div>
        );
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
