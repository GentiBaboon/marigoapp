'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSellForm } from '@/components/sell/SellFormContext';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Pencil, Info, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { productCategories, productConditions } from '@/lib/mock-data';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError, useCollection, useMemoFirebase, useFirebaseApp } from '@/firebase';
import { doc, collection, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { FirestoreAddress } from '@/lib/types';
import { z } from 'zod';

const ReviewSection = ({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode; }) => (
    <div>
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            <Button variant="ghost" onClick={onEdit} className="flex items-center gap-1.5 text-sm text-muted-foreground h-auto p-0 hover:bg-transparent hover:text-primary">
                <Pencil className="h-3 w-3" />
                Edit
            </Button>
        </div>
        <div className="space-y-1 text-sm">{children}</div>
    </div>
);

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between items-center">
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-medium text-right">{value}</span>
    </div>
);

export function ReviewStep() {
  const { formData, nextStep, goToStep, unselectDraft } = useSellForm();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const [selectedAddress, setSelectedAddress] = useState<FirestoreAddress | null>(null);

  const addressesCollection = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'addresses');
  }, [user, firestore]);

  const { data: addresses } = useCollection<FirestoreAddress>(addressesCollection);

  useEffect(() => {
    if (addresses && formData.shippingFromAddressId) {
      const addr = addresses.find(a => a.id === formData.shippingFromAddressId);
      setSelectedAddress(addr || null);
    }
  }, [addresses, formData.shippingFromAddressId]);

  const handlePublish = async () => {
    if (!user || !firestore || !formData.productId) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Session error. Please restart the listing.',
        });
        return;
    }
    
    setIsLoading(true);

    // Preparazione dati puliti per Firestore
    const productData = {
        title: String(formData.title || '').trim(),
        description: String(formData.description || '').trim(),
        brand: String(formData.brand || '').trim(),
        category: String(formData.category || '').trim(),
        price: Number(formData.price) || 0,
        condition: String(formData.condition || '').trim(),
        material: String(formData.material || '').trim(),
        color: String(formData.color || '').trim(),
        sellerId: user.uid,
        status: 'pending_review' as const,
        images: [], // Le regole richiedono un array vuoto alla creazione
        listingCreated: serverTimestamp(),
        keywords: Array.from(new Set([
          ...(formData.title || '').toLowerCase().split(/\s+/),
          ...(formData.brand || '').toLowerCase().split(/\s+/),
          ...(formData.category || '').toLowerCase().split(/\s+/)
        ].filter(k => k.length > 2))),
        ...(formData.sizeValue && { size: `${formData.sizeValue} ${formData.sizeStandard || ''}`.trim() }),
        ...(formData.pattern && { pattern: formData.pattern }),
        ...(formData.vintage !== undefined && { vintage: formData.vintage }),
    };

    // Validazione finale pre-invio
    const creationSchema = z.object({
        title: z.string().min(1, 'Title is required.').max(99),
        brand: z.string().min(1, 'Brand is required.'),
        category: z.string().min(1, 'Category is required.'),
        price: z.number().gt(0, 'Price must be greater than 0.'),
        condition: z.string().min(1, 'Condition is required.'),
        material: z.string().min(1, 'Material is required.'),
        color: z.string().min(1, 'Color is required.'),
    });

    const validation = creationSchema.safeParse(productData);

    if (!validation.success) {
        const errorField = validation.error.issues[0].path[0] as string;
        const fieldToStep: Record<string, number> = {
            'title': 4, 'brand': 1, 'category': 1, 'price': 6,
            'condition': 2, 'material': 2, 'color': 2
        };
        
        toast({
          variant: 'destructive',
          title: 'Missing information',
          description: validation.error.issues[0].message,
        });

        if (fieldToStep[errorField]) goToStep(fieldToStep[errorField]);
        setIsLoading(false);
        return;
    }

    const productRef = doc(firestore, 'products', formData.productId);

    try {
        // 1. Crea il guscio del prodotto
        await setDoc(productRef, productData);
        
        // 2. Carica le immagini se presenti
        let imageUrls: string[] = [];
        if (formData.images && formData.images.length > 0) {
            const storage = getStorage(firebaseApp);
            const uploadPromises = formData.images.map(async (imageFile, index) => {
              const fileName = `img_${Date.now()}_${index}.webp`;
              const storageRef = ref(storage, `products/${formData.productId}/${fileName}`);
              const snapshot = await uploadString(storageRef, imageFile.url, 'data_url');
              return getDownloadURL(snapshot.ref);
            });
            imageUrls = await Promise.all(uploadPromises);
        }

        // 3. Aggiorna con gli URL definitivi
        if (imageUrls.length > 0) {
            await updateDoc(productRef, { images: imageUrls });
        }
        
        nextStep(); // Vai al successo

    } catch (error: any) {
        console.error("Publishing error:", error);
        setIsLoading(false);
        
        const permissionError = new FirestorePermissionError({
            path: `products/${formData.productId}`,
            operation: 'create',
            requestResourceData: productData,
        });
        errorEmitter.emit('permission-error', permissionError);
        
        toast({
            variant: 'destructive',
            title: 'Submission failed',
            description: 'There was a problem saving your listing. Please try again.',
        });
    }
  };

  const handleSaveDraft = () => {
    unselectDraft();
    router.push('/sell');
  };
  
  const getCategoryName = (slug: string | undefined) => {
    if (!slug) return 'N/A';
    for (const mainCategory of productCategories) {
        for (const subCategory of mainCategory.subcategories) {
            if (subCategory.slug === slug) return subCategory.name;
        }
    }
    return slug;
  };
  
  const getConditionLabel = (value: string | undefined) => {
    if (!value) return 'N/A';
    return productConditions.find(c => c.value === value)?.label || value;
  };
  
  const formatPriceLocal = (value: number | undefined) => {
    if (value === undefined) return '';
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
  };
  
  return (
    <div className="space-y-8">
        <div>
            <h2 className="text-2xl font-bold">Review before listing</h2>
        </div>

        <Alert className="bg-amber-50 border-amber-200">
            <Info className="h-4 w-4 text-amber-600"/>
            <AlertDescription className="text-amber-900 text-sm">
                Double check everything: after listing, you can only add photos and lower the price.
            </AlertDescription>
        </Alert>
        
        <div className="space-y-6">
            <ReviewSection title="Details" onEdit={() => goToStep(2)}>
                 <DetailRow label="Category" value={getCategoryName(formData.category)} />
                 <DetailRow label="Condition" value={getConditionLabel(formData.condition)} />
                 <DetailRow label="Material" value={formData.material || 'N/A'} />
                 <DetailRow label="Color" value={formData.color || 'N/A'} />
                 <DetailRow label="Pattern" value={formData.pattern || 'Plain'} />
            </ReviewSection>

            <Separator/>

            <ReviewSection title="Photos" onEdit={() => goToStep(3)}>
                <div className="grid grid-cols-3 gap-2 mt-2">
                    {formData.images?.slice(0, 3).map((image, index) => (
                        <div key={index} className="relative aspect-square rounded-md overflow-hidden bg-muted">
                            <Image src={image.url} alt={`preview ${index}`} fill sizes="150px" className="object-cover" />
                        </div>
                    ))}
                </div>
            </ReviewSection>

            <Separator/>
            
             <ReviewSection title="Description" onEdit={() => goToStep(4)}>
                <p className="line-clamp-3">{formData.description}</p>
            </ReviewSection>

            <Separator/>

            <ReviewSection title="Address" onEdit={() => goToStep(5)}>
                 {selectedAddress ? (
                    <div className="text-muted-foreground">
                        <p className="font-medium text-foreground">{selectedAddress.fullName}</p>
                        <p>{selectedAddress.address}, {selectedAddress.city}</p>
                    </div>
                 ) : (
                    <p className="text-destructive">No address selected.</p>
                 )}
            </ReviewSection>
            
            <Separator/>

            <ReviewSection title="Price" onEdit={() => goToStep(6)}>
                <p className="font-semibold text-lg">{formatPriceLocal(formData.price)} (you earn {formatPriceLocal(formData.sellerEarning)})</p>
            </ReviewSection>

            <Separator/>
        </div>
        
        <div className="space-y-4 pt-4">
             <p className="text-xs text-center text-muted-foreground">
                By clicking on "Submit my item", I confirm that the information provided complies with the <Link href="#" className="underline">general terms of use</Link>.
             </p>
            <div className="flex items-center justify-between gap-4">
                <Button variant="link" className="text-foreground font-semibold px-0" onClick={handleSaveDraft}>Save draft</Button>
                <Button size="lg" className="flex-1 bg-foreground text-background hover:bg-foreground/90" onClick={handlePublish} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Submit my item
                </Button>
            </div>
        </div>
    </div>
  );
}