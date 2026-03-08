'use client';
import { Sprout, Check, ExternalLink, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useSellForm } from '@/components/sell/SellFormContext';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { useCurrency } from '@/context/CurrencyContext';
import React from 'react';

export function SuccessStep() {
    const { formData, deleteActiveDraft, activeDraft } = useSellForm();
    const { formatPrice } = useCurrency();

    // Preserve data locally before the draft context is potentially reset
    const [finalData] = React.useState({
        title: formData?.title || 'Listing Successful',
        brand: formData?.brandId || 'Designer Item',
        price: formData?.price || 0,
        image: formData?.images?.[0]?.url,
        id: activeDraft?.id
    });

    const platformFeeRate = 0.15;
    const earnings = finalData.price * (1 - platformFeeRate);

    const handleFinish = () => {
        deleteActiveDraft();
    };

    return (
        <div className="flex flex-col items-center text-center space-y-6 pt-4 pb-12 animate-in fade-in zoom-in duration-700">
            <div className="h-20 w-20 rounded-full bg-green-500 flex items-center justify-center mb-2 shadow-xl shadow-green-100">
                <Check className="h-10 w-10 text-white" strokeWidth={4} />
            </div>
            
            <div className="space-y-2">
                <h1 className="text-3xl font-bold font-headline">Listing Successful!</h1>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    Your luxury item is now live on the marketplace. We'll notify you as soon as someone makes an offer.
                </p>
            </div>

            <Separator className="w-full opacity-50" />

            <div className="flex items-center gap-4 w-full text-left bg-muted/20 p-5 rounded-2xl border-2 border-dashed border-muted-foreground/10">
                <div className="relative h-20 w-20 flex-shrink-0 bg-muted rounded-xl overflow-hidden shadow-md">
                    {finalData.image ? (
                        <Image
                            src={finalData.image}
                            alt={finalData.title}
                            fill
                            sizes="80px"
                            className="object-cover"
                        />
                    ) : (
                         <div className="h-full w-full bg-muted flex items-center justify-center font-bold text-muted-foreground opacity-20">
                            V.
                         </div>
                    )}
                </div>
                <div className="flex-1 space-y-0.5 min-w-0">
                    <p className="font-bold uppercase text-[10px] tracking-[0.1em] text-primary">{finalData.brand}</p>
                    <p className="text-foreground text-sm font-bold truncate leading-tight">{finalData.title}</p>
                    <div className="pt-2">
                        <p className="font-black text-lg leading-none">
                            {formatPrice(finalData.price)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Potential Earnings: {formatPrice(earnings)}</p>
                    </div>
                </div>
            </div>

            {finalData.id && (
                <Button variant="link" asChild className="text-sm font-bold text-primary group">
                    <Link href={`/products/${finalData.id}`}>
                        View my live listing <ExternalLink className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:scale-110" />
                    </Link>
                </Button>
            )}

            <Separator className="w-full opacity-50" />

            <div className="bg-green-50/50 text-green-900 p-5 rounded-2xl w-full text-left flex items-start gap-4 border border-green-100/50">
                 <div className="bg-green-100 rounded-full p-2.5 flex-shrink-0 shadow-sm">
                    <Sprout className="h-5 w-5 text-green-700"/>
                 </div>
                 <div className="space-y-1">
                    <p className="font-bold text-sm">Thank you for selling pre-loved</p>
                    <p className="text-[11px] text-green-800/80 leading-relaxed font-medium">You just helped reduce fashion waste and extended the lifecycle of a luxury piece. Way to go!</p>
                 </div>
            </div>
            
            <div className="flex flex-col w-full gap-3 pt-4">
                <Button asChild className="w-full bg-black text-white hover:bg-black/90 h-16 text-base font-bold rounded-full shadow-lg" onClick={handleFinish}>
                    <Link href="/sell">Sell another item</Link>
                </Button>
                <Button asChild variant="outline" className="w-full h-14 text-base font-bold rounded-full border-2" onClick={handleFinish}>
                    <Link href="/profile/listings">Manage my boutique</Link>
                </Button>
            </div>
        </div>
    );
}
