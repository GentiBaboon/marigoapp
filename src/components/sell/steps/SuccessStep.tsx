'use client';
import { Sprout, Check, ExternalLink } from 'lucide-react';
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

    // Store essential data locally before the draft is potentially cleared
    const [finalData] = React.useState({
        title: formData?.title || 'Item Submitted',
        brand: formData?.brand || 'Designer Item',
        price: formData?.price || 0,
        image: formData?.images?.[0]?.url,
        id: activeDraft?.id
    });

    const platformFeeRate = 0.15;
    const earnings = finalData.price * (1 - platformFeeRate);

    // We clear the draft when they move away
    const handleFinish = () => {
        deleteActiveDraft();
    };

    return (
        <div className="flex flex-col items-center text-center space-y-6 pt-4 pb-12 animate-in fade-in zoom-in duration-500">
            <div className="h-16 w-16 rounded-full bg-green-500 flex items-center justify-center mb-2 shadow-lg shadow-green-100">
                <Check className="h-9 w-9 text-white" strokeWidth={3} />
            </div>
            
            <div className="space-y-2">
                <h1 className="text-3xl font-bold font-headline">Item submitted</h1>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    Your listing is now live! It may take a few minutes to appear in all search results.
                </p>
            </div>

            <Separator className="w-full opacity-50" />

            <div className="flex items-center gap-4 w-full text-left bg-muted/30 p-4 rounded-xl border">
                <div className="relative h-20 w-20 flex-shrink-0 bg-muted rounded-lg overflow-hidden shadow-sm">
                    {finalData.image ? (
                        <Image
                            src={finalData.image}
                            alt={finalData.title}
                            fill
                            sizes="80px"
                            className="object-cover"
                            unoptimized={finalData.image.startsWith('blob:')}
                        />
                    ) : (
                         <div className="h-full w-full bg-muted flex items-center justify-center">
                            <span className="text-[10px] text-muted-foreground">V.</span>
                         </div>
                    )}
                </div>
                <div className="flex-1 space-y-0.5 min-w-0">
                    <p className="font-bold uppercase text-xs tracking-widest text-primary">{finalData.brand}</p>
                    <p className="text-foreground text-sm font-medium truncate">{finalData.title}</p>
                    <div className="pt-1">
                        <p className="font-bold text-base leading-none">
                            {formatPrice(finalData.price)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">Estimated earning: {formatPrice(earnings)}</p>
                    </div>
                </div>
            </div>

            {finalData.id && (
                <Button variant="link" asChild className="text-sm font-medium">
                    <Link href={`/products/${finalData.id}`} target="_blank">
                        View live listing <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                </Button>
            )}

            <Separator className="w-full opacity-50" />

            <div className="bg-green-50 text-green-900 p-4 rounded-xl w-full text-left flex items-start gap-4 border border-green-100">
                 <div className="bg-green-100 rounded-full p-2 flex-shrink-0">
                    <Sprout className="h-4 w-4 text-green-700"/>
                 </div>
                 <div className="space-y-0.5">
                    <p className="font-bold text-sm">You're supporting sustainability</p>
                    <p className="text-xs text-green-800 leading-relaxed">By selling pre-loved, you are extending the life cycle of luxury fashion and reducing environmental impact.</p>
                 </div>
            </div>
            
            <div className="flex flex-col w-full gap-3 pt-4">
                <Button asChild className="w-full bg-black text-white hover:bg-black/90 h-14 text-base" onClick={handleFinish}>
                    <Link href="/sell">Sell another item</Link>
                </Button>
                <Button asChild variant="outline" className="w-full h-14 text-base" onClick={handleFinish}>
                    <Link href="/profile/listings">View your listings</Link>
                </Button>
            </div>
        </div>
    );
}
