'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSellForm } from '@/components/sell/SellFormContext';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Pencil, Info, Loader2 } from 'lucide-react';
import { productCategories, productConditions } from '@/lib/mock-data';
import Link from 'next/link';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError, useCollection, useMemoFirebase, useFirebaseApp } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { FirestoreAddress } from '@/lib/types';

const ReviewSection = ({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode; }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{title}</h3>
            <Button variant="ghost" size="sm" onClick={onEdit} className="text-muted-foreground hover:text-primary">
                <Pencil className="h-3 w-3 mr-1.5" />
                Edit
            </Button>
        </div>
        <div className="space-y-1 text-sm">{children}</div>
    </div>
);

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between items-center py-0.5">
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-medium text-right">{value}</span>
    </div>
);

export function ReviewStep() {
  const { formData, nextStep, goToStep, unselectDraft, setFormData } = useSellForm();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const [selectedAddress, setSelectedAddress] = useState<FirestoreAddress | null>(null);

  // Ensure we have a Product ID before publishing
  useEffect(() => {
    if (!formData.productId && firestore) {
        const newId = doc(collection(firestore, 'products')).id;
        setFormData({ productId: newId });
    }
  }, [formData.productId, firestore, setFormData]);

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

  const validateData = () => {
    const required = ['title', 'brand', 'category', 'price', 'condition'];
    const missing = required.filter(k => !formData[k as keyof typeof formData]);
    
    if (missing.length > 0 || !formData.images || formData.images.length < 3) {
        toast({
            variant: 'destructive',
            title: 'Incomplete Listing',
            description: 'Please complete all required fields and upload at least 3 photos.',
        });
        return false;
    }
    return true;
  };

  const handlePublish = async () => {
    if (!user || !firestore || !formData.productId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Session expired or missing data. Please refresh.' });
        return;
    }
    
    if (!validateData()) return;

    setIsLoading(true);
    setUploadProgress(0);
    const storage = getStorage(firebaseApp);

    try {
        const totalImages = formData.images?.length || 0;
        const progresses = new Array(totalImages).fill(0);

        // 1. Upload all images in parallel
        const uploadPromises = formData.images!.map(async (imageFile, index) => {
            const fileName = `prod_${Date.now()}_${index}.webp`;
            const storagePath = `products/${user.uid}/${formData.productId}/${fileName}`;
            const storageRef = ref(storage, storagePath);
            
            // Convert to Blob using native fetch for performance
            const response = await fetch(imageFile.url);
            const blob = await response.blob();
            
            const uploadTask = uploadBytesResumable(storageRef, blob, {
                contentType: 'image/webp',
                customMetadata: { productId: formData.productId!, sellerId: user.uid }
            });

            return new Promise<string>((resolve, reject) => {
                uploadTask.on('state_changed', 
                    (snapshot) => {
                        const bytes = snapshot.totalBytes > 0 ? (snapshot.bytesTransferred / snapshot.totalBytes) : 0;
                        progresses[index] = bytes * 100;
                        const avgProgress = Math.round(progresses.reduce((a, b) => a + b, 0) / (totalImages || 1));
                        setUploadProgress(Math.min(avgProgress, 99));
                    }, 
                    (error) => reject(error), 
                    async () => {
                        const url = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve(url);
                    }
                );
            });
        });

        const imageUrls = await Promise.all(uploadPromises);

        // 1.5. Upload proof files if any
        let proofOfOriginUrls: string[] = [];
        if (formData.proofOfOrigin && formData.proofOfOrigin.length > 0) {
            const proofUploadPromises = formData.proofOfOrigin.map(async (file, index) => {
                const fileName = `proof_${Date.now()}_${index}.${file.type.split('/')[1] || 'webp'}`;
                const storagePath = `products/${user.uid}/${formData.productId}/proofs/${fileName}`;
                const storageRef = ref(storage, storagePath);

                const response = await fetch(file.url);
                const blob = await response.blob();

                await uploadBytesResumable(storageRef, blob);
                return getDownloadURL(storageRef);
            });
            proofOfOriginUrls = await Promise.all(proofUploadPromises);
        }

        const getParentCategoryName = (slug: string | undefined) => {
            if (!slug) return '';
            for (const mainCategory of productCategories) {
                if (mainCategory.subcategories.some(sub => sub.slug === slug)) return mainCategory.name;
            }
            return '';
        };

        // 2. Prepare product data
        const productData = {
            title: String(formData.title || '').trim(),
            description: String(formData.description || '').trim(),
            brand: String(formData.brand || '').trim(),
            category: getParentCategoryName(formData.category),
            subCategory: String(formData.category || '').trim(),
            gender: String(formData.gender || '').trim(),
            price: Number(formData.price),
            condition: String(formData.condition || '').trim(),
            material: String(formData.material || '').trim(),
            color: String(formData.color || '').trim(),
            sellerId: user.uid,
            status: 'pending_review',
            images: imageUrls,
            listingCreated: serverTimestamp(),
            keywords: Array.from(new Set([
              ...(formData.title || '').toLowerCase().split(/\s+/),
              ...(formData.brand || '').toLowerCase().split(/\s+/),
              ...(formData.category || '').toLowerCase().split(/\s+/)
            ].filter(k => k.length > 2))),
            ...(formData.sizeValue && { size: `${formData.sizeValue} ${formData.sizeStandard || ''}`.trim() }),
            ...(formData.pattern && { pattern: formData.pattern }),
            ...(formData.vintage !== undefined && { vintage: formData.vintage }),
            ...(formData.origin && { origin: formData.origin }),
            ...(formData.yearOfPurchase && { yearOfPurchase: formData.yearOfPurchase }),
            ...(formData.serialNumber && { serialNumber: formData.serialNumber }),
            ...(formData.packaging && { packaging: formData.packaging }),
            ...(proofOfOriginUrls.length > 0 && { proofOfOrigin: proofOfOriginUrls }),
            shippingFromAddressId: formData.shippingFromAddressId,
            views: 0,
            likes: 0
        };

        const productRef = doc(firestore, 'products', formData.productId);

        // 3. Set document and wait for confirmation
        await setDoc(productRef, productData);
        
        // 4. Success
        setUploadProgress(100);
        setIsLoading(false);
        nextStep(); 

    } catch (error: any) {
        console.error("Publishing failed:", error);
        setIsLoading(false);
        toast({ 
            variant: 'destructive', 
            title: 'Upload Failed', 
            description: error.message || 'There was a problem submitting your item. Please try again.' 
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
        <h2 className="text-2xl font-bold tracking-tight">Review before listing</h2>

        <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 flex gap-3">
            <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-amber-900 text-sm">
                Double check everything: after listing, you can only add photos and lower the price.
            </p>
        </div>
        
        <div className="space-y-6">
            <ReviewSection title="Details" onEdit={() => goToStep(2)}>
                 <DetailRow label="Category" value={getCategoryName(formData.category)} />
                 <DetailRow label="Condition" value={getConditionLabel(formData.condition)} />
                 <DetailRow label="Material" value={formData.material || 'N/A'} />
                 <DetailRow label="Color" value={formData.color || 'N/A'} />
                 <DetailRow label="Pattern" value={formData.pattern || 'Plain'} />
            </ReviewSection>

            <Separator />

            <ReviewSection title="Photos" onEdit={() => goToStep(3)}>
                <div className="grid grid-cols-3 gap-2 mt-2">
                    {formData.images?.slice(0, 3).map((image, index) => (
                        <div key={index} className="relative aspect-square rounded-md overflow-hidden bg-muted">
                            <Image src={image.url} alt={`preview ${index}`} fill sizes="150px" className="object-cover" />
                        </div>
                    ))}
                </div>
            </ReviewSection>

            <Separator />
            
             <ReviewSection title="Description" onEdit={() => goToStep(4)}>
                <p className="line-clamp-3 text-muted-foreground">{formData.description || 'No description provided.'}</p>
            </ReviewSection>

            <Separator />

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
            
            <Separator />

            <ReviewSection title="Price" onEdit={() => goToStep(6)}>
                <div className="flex flex-col">
                    <p className="font-bold text-lg">{formatPriceLocal(formData.price)}</p>
                    <p className="text-sm text-muted-foreground">You will earn approx. {formatPriceLocal(formData.sellerEarning)}</p>
                </div>
            </ReviewSection>

            <Separator />
        </div>
        
        <div className="space-y-4 pt-4">
             <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
                By clicking on "Submit my item", I confirm that the information provided complies with the <Link href="/terms" className="underline">general terms of use</Link>.
             </p>
            <div className="flex flex-col gap-3">
                <Button 
                    size="lg" 
                    className="w-full h-14 text-base bg-foreground text-background hover:bg-foreground/90 transition-all" 
                    onClick={handlePublish} 
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Uploading {uploadProgress}%</span>
                        </div>
                    ) : 'Submit my item'}
                </Button>
                <button 
                    type="button" 
                    className="text-muted-foreground font-medium text-sm hover:underline py-2 disabled:opacity-50" 
                    onClick={handleSaveDraft} 
                    disabled={isLoading}
                >
                    Save as draft and exit
                </button>
            </div>
        </div>
    </div>
  );
}
