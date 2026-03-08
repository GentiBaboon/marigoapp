'use client';
import { useSellForm } from '../SellFormContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Edit2, Loader2, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useStorage, useMemoFirebase } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';
import { ProductService } from '@/services/product.service';
import { validateListingData, notifyNewListing } from '@/app/sell/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { collection } from 'firebase/firestore';
import { useCollection } from '@/firebase';
import type { FirestoreAddress, FirestoreProduct } from '@/lib/types';
import { cn } from '@/lib/utils';

export function ReviewStep() {
  const { formData, goToStep, nextStep, activeDraft } = useSellForm();
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();

  const addressesCollection = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'addresses');
  }, [user, firestore]);
  
  const { data: addresses } = useCollection<FirestoreAddress>(addressesCollection);
  const selectedAddress = addresses?.find(a => a.id === formData.shippingFromAddressId);

  const resolveImageBlob = async (img: any): Promise<Blob> => {
    // Priority 1: Raw File object from memory
    if (img.file instanceof Blob) return img.file;
    
    // Priority 2: Fetch from local Blob URL if file is missing (backup)
    try {
      const response = await fetch(img.url);
      if (!response.ok) throw new Error("Local blob fetch failed");
      return await response.blob();
    } catch (e) {
      console.error("Failed to resolve image blob:", e);
      throw new Error(`Photo ${img.position + 1} is no longer available. Please go back and re-upload.`);
    }
  };

  const handlePublish = async () => {
    if (!user || !firestore || !storage) {
        toast({ variant: "destructive", title: "Connection Error", description: "Firebase services are not available." });
        return;
    }

    setIsPublishing(true);
    setError(null);
    setUploadProgress(0);
    setStatusMessage('Validating listing...');

    try {
      const productId = activeDraft?.id || `prod_${Date.now()}`;
      const images = formData.images || [];
      
      if (images.length === 0) throw new Error("At least one photo is required.");

      // 1. Server-Side Validation via Action
      const validation = await validateListingData({
          productId,
          sellerId: user.uid,
          title: formData.title,
          price: formData.price,
          status: 'active'
      });

      if (!validation.success) {
          const firstError = Object.values(validation.errors || {})[0];
          throw new Error(Array.isArray(firstError) ? firstError[0] : "Listing details are invalid.");
      }

      const finalImages = [];
      
      // 2. Sequential Uploads
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const stepBase = (i / images.length) * 80;
        
        setStatusMessage(`Preparing photo ${i + 1}...`);
        setUploadProgress(stepBase + 5);
        
        const blob = await resolveImageBlob(img);
        
        const fileExt = img.type?.split('/')[1] || 'jpg';
        const fileName = `img_${Date.now()}_${i}.${fileExt}`;
        const storagePath = `products/${user.uid}/${productId}/${fileName}`;
        const storageRef = ref(storage, storagePath);
        
        const metadata = {
            contentType: img.type || 'image/jpeg',
            customMetadata: { originalName: img.name || 'listing_image' }
        };

        setStatusMessage(`Uploading photo ${i + 1} of ${images.length}...`);
        await uploadBytes(storageRef, blob, metadata);
        const downloadUrl = await getDownloadURL(storageRef);

        finalImages.push({ url: downloadUrl, position: i });
        setUploadProgress(stepBase + (80 / images.length));
      }

      // 3. Firestore Finalization
      setStatusMessage('Creating your listing...');
      setUploadProgress(90);

      const productData: Partial<FirestoreProduct> = {
        id: productId,
        sellerId: user.uid,
        title: formData.title || 'Untitled',
        description: formData.description || '',
        categoryId: formData.categoryId || 'uncategorized',
        subcategoryId: formData.subcategoryId || 'uncategorized',
        brandId: formData.brandId || 'other',
        condition: formData.condition || 'good',
        listingType: formData.listingType || 'fixed_price',
        price: formData.price || 0,
        currency: 'EUR',
        size: formData.sizeValue || '',
        color: formData.color,
        material: formData.material,
        gender: formData.gender || 'unisex',
        images: finalImages,
        status: 'active',
        vintage: formData.vintage,
        pattern: formData.pattern,
        shippingFromAddressId: formData.shippingFromAddressId,
      };

      await ProductService.publishProduct(firestore, productData);
      
      // Trigger background tasks (non-blocking)
      notifyNewListing(productData.title!, user.displayName || "A member").catch(console.warn);

      setUploadProgress(100);
      setStatusMessage('Success!');
      
      setTimeout(() => nextStep(), 800);

    } catch (e: any) {
      console.error("Publishing Failed:", e);
      setError(e.message || "An unexpected error occurred during publishing.");
      setIsPublishing(false);
      setUploadProgress(0);
      setStatusMessage('');
    }
  };

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold font-headline tracking-tight">Review Listing</h2>
        <p className="text-muted-foreground text-sm">Review your details before going live.</p>
      </div>

      {error && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/5 shadow-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Upload Interrupted</AlertTitle>
              <AlertDescription className="mt-2 text-xs leading-relaxed">
                  {error}
              </AlertDescription>
          </Alert>
      )}

      {/* Main Preview */}
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border-2 bg-muted shadow-lg group">
        {formData.images?.[0] ? (
            <Image 
                src={formData.images[0].url} 
                alt="Product preview" 
                fill 
                className="object-cover transition-transform duration-500 group-hover:scale-105" 
                unoptimized={formData.images[0].url.startsWith('blob:')}
            />
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-xs">No preview available</p>
            </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        {!isPublishing && (
            <Button 
                variant="secondary" 
                size="sm" 
                className="absolute bottom-4 right-4 h-10 px-4 rounded-full shadow-lg bg-white text-black hover:bg-gray-100 font-bold text-xs" 
                onClick={() => goToStep(1)} 
            >
              <Edit2 className="h-3 w-3 mr-2" /> Edit Photos
            </Button>
        )}
      </div>

      {/* Progress Card */}
      {isPublishing && (
          <Card className="border-primary/20 bg-primary/5 shadow-inner">
              <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-primary">
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {statusMessage}
                      </span>
                      <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-1.5 bg-primary/10" />
              </CardContent>
          </Card>
      )}

      {/* Summary Section */}
      <div className="space-y-4">
        <Card className="border-none bg-muted/30 shadow-sm rounded-xl">
            <CardContent className="p-5 space-y-5">
                <div className="flex justify-between items-start">
                    <div className="space-y-0.5 min-w-0">
                        <h3 className="font-bold text-xl uppercase tracking-tighter text-primary truncate">
                            {formData.brandId || 'Designer Item'}
                        </h3>
                        <p className="text-muted-foreground font-medium text-sm line-clamp-1">{formData.title || 'Product Title'}</p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-xl font-black">€{formData.price}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Fixed</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-muted-foreground/10">
                    <div className="space-y-0.5">
                        <p className="text-muted-foreground uppercase text-[9px] font-black tracking-widest">Condition</p>
                        <p className="font-bold capitalize text-xs">{formData.condition?.replace('_', ' ') || 'N/A'}</p>
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-muted-foreground uppercase text-[9px] font-black tracking-widest">Size</p>
                        <p className="font-bold text-xs">{formData.sizeValue || 'O/S'}</p>
                    </div>
                </div>
            </CardContent>
        </Card>

        {selectedAddress && (
            <div className="p-4 bg-background rounded-xl border flex items-center gap-4 shadow-sm">
                <div className="p-2 bg-primary/5 rounded-full shrink-0">
                    <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div className="text-xs overflow-hidden">
                    <p className="font-black uppercase text-[8px] text-muted-foreground tracking-widest mb-0.5">Shipping From</p>
                    <p className="font-bold text-foreground truncate">{selectedAddress.fullName}</p>
                    <p className="text-muted-foreground truncate">{selectedAddress.city}, {selectedAddress.country}</p>
                </div>
            </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col gap-3 pt-4">
        <Button 
            className={cn(
                "w-full h-14 text-base font-bold shadow-xl transition-all active:scale-[0.98] rounded-full",
                isPublishing ? "bg-muted text-muted-foreground" : "bg-black text-white hover:bg-black/90"
            )} 
            size="lg" 
            onClick={handlePublish} 
            disabled={isPublishing}
        >
          {isPublishing ? (
              <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
              </span>
          ) : "Confirm & Publish"}
        </Button>
        
        {!isPublishing && (
            <Button 
                variant="ghost" 
                className="w-full h-10 font-bold text-muted-foreground hover:text-foreground uppercase tracking-widest text-[10px]" 
                onClick={() => goToStep(5)}
            >
              Back to Pricing
            </Button>
        )}
      </div>
    </div>
  );
}
