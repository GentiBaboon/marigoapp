'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { FirestoreDelivery } from '@/lib/types';
import { Truck, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface ActiveDeliveryCardProps {
  delivery: FirestoreDelivery;
}

export function ActiveDeliveryCard({ delivery }: ActiveDeliveryCardProps) {
  const statusLabels: Record<string, string> = {
    assigned: 'Ready for pickup',
    arrived_for_pickup: 'At pickup location',
    picked_up: 'On your way to deliver',
    in_transit: 'On your way to deliver',
    arrived_for_delivery: 'At delivery location',
  };

  return (
    <Card className="bg-primary text-primary-foreground">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Active Delivery
        </CardTitle>
        <CardDescription className="text-primary-foreground/80">
          {statusLabels[delivery.status] || 'Manage your active delivery.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <p className="font-semibold">
              {delivery.addresses.pickup.city} to{' '}
              {delivery.addresses.delivery.city}
            </p>
            <p className="text-sm text-primary-foreground/80">
              Order #{delivery.orderId.slice(0, 8)}...
            </p>
          </div>
          <Button asChild variant="secondary" className="w-full sm:w-auto">
            <Link href={`/courier/delivery/${delivery.id}`}>
              Manage Delivery
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
