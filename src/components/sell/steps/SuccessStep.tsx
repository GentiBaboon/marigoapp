'use client';
import { useEffect, useRef } from 'react';
import { Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useSellForm } from '@/components/sell/SellFormContext';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import type { SellFormValues } from '@/lib/types';

const GreenCheckIcon = () => (
    <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>
    </div>
);


export function SuccessStep() {
    const { formData, deleteActiveDraft } = useSellForm();
    // Snapshot the form data on mount before the draft gets deleted
    const savedData = useRef<Partial<SellFormValues>>(formData);

    useEffect(() => {
        // Delete the completed draft from localStorage after data is captured in ref
        deleteActiveDraft();
    }, [deleteActiveDraft]);

    // Use the snapshotted data so the UI doesn't go blank after draft deletion
    const data = savedData.current;

    const currencyFormatter = (value: number | undefined) => {
        if (value === undefined) return '';
        const currency = data.currency || 'EUR';
        let locale = 'en-US';
        if (currency === 'EUR') locale = 'de-DE';
        if (currency === 'ALL') locale = 'sq-AL';

        try {
            return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
        } catch(e) {
            return `${currency} ${value}`;
        }
    }

    const buyerServiceFee = 6;
    const title = data.title;

    return (
        <div className="flex flex-col items-center text-center space-y-6">
            <GreenCheckIcon />
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold">Item submitted</h1>
                <p className="text-muted-foreground max-w-xs">
                    We'll review your listing, edit the main photo, and email you an update soon.
                </p>
            </div>

            <Separator className="w-full" />

            <div className="flex items-center gap-4 w-full text-left">
                <div className="relative h-20 w-20 flex-shrink-0 bg-muted rounded-md">
                    {data.images && data.images.length > 0 ? (
                        <Image
                            src={data.images[0].url}
                            alt={title || 'Submitted item'}
                            fill
                            sizes="80px"
                            className="object-cover rounded-md"
                        />
                    ) : (
                         <div className="h-full w-full bg-muted rounded-md" />
                    )}
                </div>
                <div className="flex-1">
                    <p className="font-semibold uppercase text-muted-foreground text-sm">{data.brand || 'NON SIGNÉ / UNSIGNED'}</p>
                    <p className="font-medium">{title || 'Cloth handbag'}</p>
                    <p className="font-semibold">{currencyFormatter(data.price)} (You earn {currencyFormatter(data.sellerEarning)})</p>
                    <p className="text-sm text-muted-foreground">Buyer service fee not included ({currencyFormatter(buyerServiceFee)})</p>
                </div>
            </div>

            <Separator className="w-full" />

            <div className="bg-green-50 text-green-900 p-4 rounded-lg w-full text-left flex items-start gap-4">
                 <div className="border border-green-200 rounded-full p-1 mt-1">
                    <Sprout className="h-4 w-4 text-green-700"/>
                 </div>
                 <div>
                    <p className="font-semibold">You're supporting sustainability</p>
                    <p className="text-sm">82% of items sold with us replace a new purchase.</p>
                 </div>
            </div>

            <div className="flex w-full gap-4 pt-4">
                <Button asChild variant="outline" className="w-full" size="lg">
                    <Link href="/profile/listings">View your listings</Link>
                </Button>
                <Button asChild className="w-full bg-foreground text-background hover:bg-foreground/90" size="lg">
                    <Link href="/sell">Sell another item</Link>
                </Button>
            </div>
        </div>
    );
}
