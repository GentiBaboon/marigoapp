
'use client';
import { Sprout, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useSellForm } from '@/components/sell/SellFormContext';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { useCurrency } from '@/context/CurrencyContext';

export function SuccessStep() {
    const { formData, deleteActiveDraft } = useSellForm();
    const { formatPrice } = useCurrency();

    // Mocking values for display consistency with the requested design
    const buyerServiceFee = 6;
    const title = formData.title || 'Cloth handbag';
    const brand = formData.brand || 'NON SIGNÉ / UNSIGNED';
    const price = formData.price || 0;
    const earnings = formData.sellerEarning || 0;

    const handleFinish = () => {
        deleteActiveDraft();
    };

    return (
        <div className="flex flex-col items-center text-center space-y-6 pt-4 pb-12">
            <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center mb-2">
                <Check className="h-7 w-7 text-white" strokeWidth={3} />
            </div>
            
            <div className="space-y-2">
                <h1 className="text-2xl font-bold font-headline">Item submitted</h1>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    We'll review your listing, edit the main photo, and email you an update soon.
                </p>
            </div>

            <Separator className="w-full" />

            <div className="flex items-center gap-4 w-full text-left">
                <div className="relative h-20 w-20 flex-shrink-0 bg-muted rounded-md overflow-hidden">
                    {formData.images && formData.images.length > 0 ? (
                        <Image
                            src={formData.images[0].url}
                            alt={title}
                            fill
                            sizes="80px"
                            className="object-cover"
                        />
                    ) : (
                         <div className="h-full w-full bg-muted flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">No image</span>
                         </div>
                    )}
                </div>
                <div className="flex-1 space-y-0.5">
                    <p className="font-bold uppercase text-sm tracking-tight">{brand}</p>
                    <p className="text-muted-foreground text-sm">{title}</p>
                    <p className="font-semibold text-base">
                        {formatPrice(price)} <span className="text-muted-foreground font-normal">(You earn {formatPrice(earnings)})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">The buyer will also pay a {formatPrice(buyerServiceFee)} service fee.</p>
                </div>
            </div>

            <Separator className="w-full" />

            <div className="bg-green-50 text-green-900 p-4 rounded-lg w-full text-left flex items-start gap-4">
                 <div className="border border-green-200 rounded-full p-1.5 mt-0.5 flex-shrink-0">
                    <Sprout className="h-4 w-4 text-green-700"/>
                 </div>
                 <div className="space-y-0.5">
                    <p className="font-semibold text-sm">You're supporting sustainability</p>
                    <p className="text-xs text-green-800">82% of items sold with us replace a new purchase.</p>
                 </div>
            </div>
            
            <div className="flex w-full gap-4 pt-4">
                <Button asChild variant="outline" className="flex-1 border-foreground text-foreground" size="lg" onClick={handleFinish}>
                    <Link href="/profile/listings">View your listings</Link>
                </Button>
                <Button asChild className="flex-1 bg-black text-white hover:bg-black/90" size="lg" onClick={handleFinish}>
                    <Link href="/sell">Sell another item</Link>
                </Button>
            </div>
        </div>
    );
}
