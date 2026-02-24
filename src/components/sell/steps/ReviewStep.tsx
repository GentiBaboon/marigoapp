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
import { FirestoreProduct, FirestoreAddress } from '@/lib/types';
import { z } from 'zod';

// Helper component for each review section
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

// Helper for detail rows
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
            description: 'You must be signed in and have a valid draft to create a listing.',
        });
        return;
    }
    
    setIsLoading(true);

    const productForCreation = {
        title: formData.title || '',
        description: formData.description || '',
        brand: formData.brand || '',
        category: formData.category || '',
        price: Number(formData.price) || 0,
        condition: formData.condition || '',
        material: formData.material || '',
        color: formData.color || '',
        sellerId: user.uid,
        status: 'pending_review' as const,
        images: [],
        listingCreated: serverTimestamp(),
        // Optional fields that are not required by the strict rule
        ...(formData.subCategory && { subCategory: formData.subCategory }),
        ...(formData.sizeValue && { size: `${formData.sizeValue} ${formData.sizeStandard || ''}`.trim() }),
        ...(formData.pattern && { pattern: formData.pattern }),
        ...(formData.vintage && { vintage: formData.vintage }),
        keywords: Array.from(new Set([
          ...(formData.title || '').toLowerCase().split(' '),
          ...(formData.brand || '').toLowerCase().split(' '),
          ...(formData.category || '').toLowerCase().split(' '),
        ].filter(Boolean))),
      };

    const creationSchema = z.object({
        sellerId: z.string().min(1),
        status: z.literal('pending_review'),
        images: z.array(z.any()).length(0),
        title: z.string().min(1, 'Title is required.').max(99),
        description: z.string().min(1, 'Description is required.'),
        brand: z.string().min(1, 'Brand is required.'),
        category: z.string().min(1, 'Category is required.'),
        price: z.number().gt(0, 'Price must be greater than 0.'),
        condition: z.string().min(1, 'Condition is required.'),
        material: z.string().min(1, 'Material is required.'),
        color: z.string().min(1, 'Color is required.'),
    });

    const validationResult = creationSchema.safeParse(productForCreation);

    if (!validationResult.success) {
        const firstError = validationResult.error.issues[0];
        const fieldToStepMap: Record<string, number> = {
            'title': 4, 'description': 4,
            'brand': 1, 'category': 1,
            'price': 6,
            'condition': 2, 'material': 2, 'color': 2,
        };
        const errorField = firstError.path[0] as string;
        
        toast({
          variant: 'destructive',
          title: 'Incomplete Listing',
          description: `Please complete all required fields. ${firstError.message}`,
          duration: 5000,
        });

        // Guide user to the correct step
        const stepToGo = fieldToStepMap[errorField];
        if (stepToGo) {
            goToStep(stepToGo);
        }
        setIsLoading(false);
        return;
    }

    const productRef = doc(firestore, 'products', formData.productId);

    try {
        await setDoc(productRef, validationResult.data);
        
        let imageUrls: string[] = [];
        if (formData.images && formData.images.length > 0) {
            const storage = getStorage(firebaseApp);
            const uploadPromises = formData.images.map(imageFile => {
              const storageRef = ref(storage, `products/${formData.productId}/${Date.now()}-${imageFile.name}`);
              return uploadString(storageRef, imageFile.url, 'data_url').then(snapshot => getDownloadURL(snapshot.ref));
            });
            imageUrls = await Promise.all(uploadPromises);
        }

        if (imageUrls.length > 0) {
            await updateDoc(productRef, {
                images: imageUrls,
            });
        }
        
        nextStep();

    } catch (error: any) {
        console.error("Publishing error:", error);
        const permissionError = new FirestorePermissionError({
            path: `products/${formData.productId}`,
            operation: error.code?.includes('permission') ? 'create' : 'write',
            requestResourceData: { error: 'data too large to display' },
        });
        errorEmitter.emit('permission-error', permissionError);
        
        toast({
            variant: 'destructive',
            title: 'Publishing Failed',
            description: 'There was a problem publishing your listing. Please check your connection and try again.',
        });
    } finally {
        setIsLoading(false);
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
            if (subCategory.slug === slug) {
                return subCategory.name;
            }
        }
    }
    return slug;
  }
  
  const getConditionLabel = (value: string | undefined) => {
    if (!value) return 'N/A';
    const condition = productConditions.find(c => c.value === value);
    return condition?.label || value;
  }
  
  const currencyFormatter = (value: number | undefined) => {
    if (value === undefined) return '';
    const currency = formData.currency || 'EUR';
    let locale = 'de-DE';
    if (currency === 'ALL') {
      locale = 'sq-AL';
    }

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
      }).format(value);
    } catch (e) {
      return `${value} ${currency}`;
    }
  };
  
  return (
    <div className="space-y-8">
        <div>
            <h2 className="text-2xl font-bold">Review before listing</h2>
        </div>

        <Alert variant="default" className="bg-amber-50 border-amber-200">
            <Info className="h-4 w-4 text-amber-600"/>
            <AlertDescription className="text-amber-900">
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
                <p className="text-muted-foreground text-xs">Main photo</p>
                <div className="grid grid-cols-3 gap-2 mt-2">
                    {formData.images?.slice(0, 3).map((image, index) => (
                        <div key={index} className="relative aspect-[1/1] rounded-md overflow-hidden bg-muted">
                            <Image src={image.url} alt={`preview ${index}`} fill sizes="150px" className="object-cover" />
                        </div>
                    ))}
                </div>
            </ReviewSection>

            <Separator/>
            
             <ReviewSection title="Description" onEdit={() => goToStep(4)}>
                <p className="text-foreground">{formData.description}</p>
            </ReviewSection>

            <Separator/>

            <ReviewSection title="Address" onEdit={() => goToStep(5)}>
                 {selectedAddress ? (
                    <>
                        <p className="font-medium">{selectedAddress.fullName}</p>
                        <p className="text-muted-foreground">{selectedAddress.address}, {selectedAddress.city} {selectedAddress.postal}, {selectedAddress.country}</p>
                    </>
                 ) : (
                    <p className="text-muted-foreground">No address selected.</p>
                 )}
            </ReviewSection>
            
            <Separator/>

            <ReviewSection title="Price" onEdit={() => goToStep(6)}>
                <p className="font-semibold text-lg">{currencyFormatter(formData.price)} (you earn {currencyFormatter(formData.sellerEarning)})</p>
                <p className="text-sm text-muted-foreground flex items-center">
                    Buyer service fee not included
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 cursor-default">
                                    <Info className="h-3 w-3" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>The buyer will pay an additional service fee on top of your listing price.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </p>
            </ReviewSection>

            <Separator/>
        </div>
        
        <div className="space-y-4 pt-4">
             <p className="text-xs text-center text-muted-foreground">
                By clicking on "Submit my item", I confirm that the information provided complies with the <Link href="#" className="underline">general terms of use</Link>.
             </p>
            <div className="flex items-center justify-between">
                <Button variant="link" className="text-foreground font-semibold px-0" onClick={handleSaveDraft}>Save draft</Button>
                <Button size="lg" className="bg-foreground text-background hover:bg-foreground/90" onClick={handlePublish} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit my item
                </Button>
            </div>
        </div>
    </div>
  );
}
