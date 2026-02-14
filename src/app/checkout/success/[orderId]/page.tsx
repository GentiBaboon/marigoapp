'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { FirestoreOrder } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { X, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import Confetti from 'react-confetti';
import { useWindowSize } from '@/hooks/use-window-size';

const currencyFormatter = (value: number, currency: string = 'EUR') => {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value);
};

const AnimatedCheck = () => (
  <motion.div
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{
      type: "spring",
      stiffness: 260,
      damping: 20,
      delay: 0.5,
    }}
    className="h-20 w-20 rounded-full bg-green-500 flex items-center justify-center"
  >
    <Check className="h-12 w-12 text-white" strokeWidth={3} />
  </motion.div>
);

function ConfirmationSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-5 w-48" />
            </div>
            <Skeleton className="h-px w-full max-w-sm" />
             <div className="space-y-2">
                <Skeleton className="h-5 w-80" />
                <Skeleton className="h-5 w-72" />
            </div>
            <div className="flex flex-col gap-4 w-full max-w-xs pt-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    )
}


export default function OrderSuccessPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const firestore = useFirestore();
  const { width, height } = useWindowSize();
  
  const orderRef = useMemoFirebase(() => {
    if (!firestore || !orderId) return null;
    return doc(firestore, 'orders', orderId);
  }, [firestore, orderId]);

  const { data: order, isLoading } = useDoc<FirestoreOrder>(orderRef);

  return (
    <div className="relative container mx-auto max-w-xl py-8 px-4">
        {width && height && <Confetti width={width} height={height} recycle={false} numberOfPieces={300} />}
      <header className="flex justify-end mb-8">
        <Button variant="ghost" size="icon" asChild>
            <Link href="/home">
                <X className="h-6 w-6" />
                <span className="sr-only">Close</span>
            </Link>
        </Button>
      </header>

      {isLoading || !order ? (
          <ConfirmationSkeleton />
      ) : (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col items-center text-center space-y-6"
        >
            <AnimatedCheck />

            <div className="space-y-2">
                <h1 className="text-3xl font-bold font-headline">Order Confirmed!</h1>
                <p className="font-logo text-2xl font-bold">marigo</p>
            </div>
            
            <Separator className="max-w-sm" />

            <div className="space-y-2">
                 <p className="text-lg text-muted-foreground">
                    We got your order{' '}
                    <span className="font-semibold text-foreground">#{order.orderNumber}</span> for{' '}
                    <span className="font-semibold text-foreground">{currencyFormatter(order.totalAmount)}</span>.
                </p>
                <p className="text-muted-foreground">You'll receive a confirmation email shortly.</p>
            </div>

            <div className="w-full max-w-xs pt-6 space-y-4">
                <Button size="lg" asChild className="w-full">
                    <Link href={`/profile/orders/${order.id}`}>
                        Track Your Order
                    </Link>
                </Button>
                 <Button size="lg" variant="outline" asChild className="w-full">
                    <Link href="/home">Keep Shopping</Link>
                </Button>
            </div>
        </motion.div>
      )}
    </div>
  );
}
