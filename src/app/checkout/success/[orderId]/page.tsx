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
import { X, Check, Package, MapPin, CreditCard, ShoppingBag, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Confetti from 'react-confetti';
import { useWindowSize } from '@/hooks/use-window-size';
import { useCurrency } from '@/context/CurrencyContext';

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
    className="h-20 w-20 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-100"
  >
    <Check className="h-12 w-12 text-white" strokeWidth={3} />
  </motion.div>
);

function ConfirmationSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2">
                <Skeleton className="h-8 w-64 mx-auto" />
                <Skeleton className="h-5 w-48 mx-auto" />
            </div>
            <Separator className="max-w-sm mx-auto" />
            <div className="space-y-4 w-full max-w-sm">
                <Skeleton className="h-20 w-full rounded-lg" />
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
  const { formatPrice } = useCurrency();
  
  const orderRef = useMemoFirebase(() => {
    if (!firestore || !orderId) return null;
    return doc(firestore, 'orders', orderId);
  }, [firestore, orderId]);

  const { data: order, isLoading } = useDoc<FirestoreOrder>(orderRef);

  return (
    <div className="relative container mx-auto max-w-xl py-12 px-4">
        {width && height && <Confetti width={width} height={height} recycle={false} numberOfPieces={200} />}
      
      <header className="flex justify-end mb-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
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
            className="flex flex-col items-center text-center space-y-8"
        >
            <AnimatedCheck />

            <div className="space-y-3">
                <h1 className="text-4xl font-bold font-headline">Thank you!</h1>
                <p className="text-xl text-muted-foreground">Order <span className="font-semibold text-foreground">#{order.orderNumber}</span> has been placed.</p>
            </div>
            
            <Separator className="max-w-sm" />

            {/* Order details preview */}
            <div className="w-full bg-muted/30 p-6 rounded-2xl border space-y-5 text-left">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                        <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-bold">Order Summary</h3>
                        <p className="text-xs text-muted-foreground">
                            {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                        </p>
                    </div>
                </div>

                {/* Item rows with thumbnails */}
                <ul className="space-y-3">
                    {order.items.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-3">
                            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                                {item.image && (
                                    <Image
                                        src={item.image}
                                        alt={item.title}
                                        fill
                                        sizes="56px"
                                        className="object-cover"
                                    />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] uppercase tracking-widest text-primary font-bold truncate">
                                    {item.brand}
                                </p>
                                <p className="text-sm font-medium truncate">{item.title}</p>
                            </div>
                            <span className="text-sm font-semibold">{formatPrice(item.price)}</span>
                        </li>
                    ))}
                </ul>

                <Separator />

                {/* Money breakdown */}
                <div className="space-y-1.5 text-sm">
                    {typeof order.discountAmount === 'number' && order.discountAmount > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                            <span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span>
                            <span>− {formatPrice(order.discountAmount)}</span>
                        </div>
                    )}
                    {typeof order.taxAmount === 'number' && order.taxAmount > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                            <span>Tax</span>
                            <span>{formatPrice(order.taxAmount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-2 border-t">
                        <span>Total Paid</span>
                        <span>{formatPrice(order.totalAmount)}</span>
                    </div>
                </div>

                {/* Shipping + payment chips */}
                <div className="space-y-3 pt-1">
                    {order.shippingAddress && (
                        <div className="flex items-start gap-2 text-xs">
                            <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="text-muted-foreground leading-tight">
                                <p className="font-semibold text-foreground">
                                    {order.shippingAddress.fullName}
                                </p>
                                <p>
                                    {order.shippingAddress.address}, {order.shippingAddress.city}
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CreditCard className="h-4 w-4 shrink-0" />
                        <span>
                            Paid by {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Card'}
                        </span>
                        <Check className="h-3 w-3 text-green-600" />
                    </div>
                </div>
            </div>

            {/* Action buttons */}
            <div className="w-full max-w-sm space-y-3 pt-2">
                <Button
                    size="lg"
                    asChild
                    className="w-full h-14 text-base font-bold bg-black hover:bg-black/90"
                >
                    <Link href="/home">
                        Continue Shopping
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
                <Button
                    size="lg"
                    variant="outline"
                    asChild
                    className="w-full h-14 text-base font-medium"
                >
                    <Link href="/profile/orders">
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        View My Orders
                    </Link>
                </Button>
                <Button
                    variant="ghost"
                    asChild
                    className="w-full text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                    <Link href={`/profile/orders/${order.id}`}>
                        Track this order →
                    </Link>
                </Button>
            </div>

            <p className="text-sm text-muted-foreground">
                We've sent a confirmation email to your registered address.
            </p>
        </motion.div>
      )}
    </div>
  );
}
