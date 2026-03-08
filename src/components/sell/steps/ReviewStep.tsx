'use client';
import { useSellForm } from '../SellFormContext';
import { Button } from '@/components/ui/button';
import { Edit2, Loader2, MapPin, AlertCircle, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useStorage, useMemoFirebase } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';
import { ProductService } from '@/services/product.service';
import { validateListingData, notifyNewListing } from '@/app/sell/actions';
import imageCompression from 'browser-image-compression';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { collection } from 'firebase/firestore';
import { useCollection } from '@/firebase';
import type { FirestoreAddress, FirestoreProduct } from '@/lib/types';

export function ReviewStep() {
  const { formData, goToStep, nextStep, activeDraft } = useSellForm();
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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

  // Check if any images are invalid (blobs without files)
  const deadBlobs = formData.images?.filter(img => img.url.startsWith('blob:') && !img.file) || [];
  const hasDeadImages = deadBlobs.length > 0;

  const handlePublish = async () => {
    if (!user || !firestore || !storage) {
        toast({ variant: "destructive", title: "Authentication required" });
        return;
    }

    if (hasDeadImages) {
        setError("Some images were lost from browser memory. Please re-upload them in the Photos step.");
        return;
    }
    
    setIsPublishing(true);
    setError(null);
    setUploadProgress(5);

    try {
      const productId = activeDraft?.id || `prod_${Date.now()}`;
      const images = formData.images || [];
      
      // 1. Server-Side Pre-Validation (Next.js Server Action)
      const validation = await validateListingData({
          productId,
          sellerId: user.uid,
          title: formData.title,
          price: formData.price,
          status: 'active'
      });

      if (!validation.success) {
          const firstError = Object.values(validation.errors || {})[0];
          throw new Error(Array.isArray(firstError) ? firstError[0] : "Server validation failed.");
      }

      const finalImages = [];
      
      // 2. Optimized Sequential Upload with Compression
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        let finalUrl = img.url;

        // If it's a new upload (has file or is a blob)
        if (img.url.startsWith('blob:') || img.file) {
          try {
            const fileToUpload = img.file || await (await fetch(img.url)).blob();
            
            const compressionOptions = { 
                maxSizeMB: 0.8, 
                maxWidthOrHeight: 1600, 
                useWebWorker: true 
            };
            const compressed = await imageCompression(fileToUpload as File, compressionOptions);
            
            const fileExt = img.type?.split('/')[1] || 'jpg';
            const fileName = `img_${Date.now()}_${i}.${fileExt}`;
            const storagePath = `products/${user.uid}/${productId}/${fileName}`;
            const storageRef = ref(storage, storagePath);
            
            const uploadTask = uploadBytesResumable(storageRef, compressed);

            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', 
                (snap) => {
                    // Update progress per file
                    const chunkWeight = 80 / images.length;
                    const fileProgress = (snap.bytesTransferred / snap.totalBytes) * chunkWeight;
                    const baseProgress = 10 + (i * chunkWeight);
                    setUploadProgress(Math.min(90, baseProgress + fileProgress));
                },
                (err) => reject(new Error(`Storage error at image ${i+1}: ${err.message}`)),
                () => resolve(null)
                );
            });

            finalUrl = await getDownloadURL(storageRef);
          } catch (fileErr: any) {
              console.warn(`Failed to process image ${i}:`, fileErr);
              throw new Error(`Failed to upload image ${i+1}. Ensure your connection is stable.`);
          }
        }

        finalImages.push({ url: finalUrl, position: i });
      }

      setUploadProgress(95);

      // 3. Final Firestore Write via Service Layer (Atomic)
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
      
      // 4. Async Notification (don't block UI if this fails)
      notifyNewListing(productData.title!, user.displayName || "A user").catch(console.warn);

      setUploadProgress(100);
      toast({ title: "Success!", description: "Your item is now live.", variant: "success" });
      
      // Delay slightly so user sees 100%
      setTimeout(() => nextStep(), 800);

    } catch (e: any) {
      console.error("Publishing error catch:", e);
      setError(e.message || "An unexpected error occurred during publishing.");
      setIsPublishing(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-8 pb-20 max-w-lg mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold font-headline">Review Listing</h2>
        <p className="text-muted-foreground">Almost there! Review your details before going live.</p>
      </div>

      {error && (
          <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Publishing Failed</AlertTitle>
              <AlertDescription className="flex flex-col gap-3">
                  {error}
                  {hasDeadImages && (
                      <Button variant="outline" size="sm" className="w-fit" onClick={() => goToStep(1)}>
                          <RefreshCw className="mr-2 h-3 w-3" /> Fix Images
                      </Button>
                  )}
              </AlertDescription>
          </Alert>
      )}

      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border-2 bg-muted shadow-lg group">
        {formData.images?.[0] && (
            <Image 
                src={formData.images[0].url} 
                alt="Main product" 
                fill 
                className="object-cover" 
                unoptimized={formData.images[0].url.startsWith('blob:')}
            />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
        <Button 
            variant="secondary" 
            size="sm" 
            className="absolute bottom-4 right-4 shadow-md" 
            onClick={() => goToStep(1)} 
            disabled={isPublishing}
        >
          <Edit2 className="h-4 w-4 mr-2" /> Change Photos
        </Button>
      </div>

      {isPublishing && (
          <div className="space-y-3 bg-primary/5 p-6 rounded-2xl border border-primary/20 animate-pulse">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-primary">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Uploading & Validating...
                  </span>
                  <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
          </div>
      )}

      <div className="space-y-6">
        <Card className="border-none bg-muted/20">
            <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <h3 className="font-bold text-2xl uppercase tracking-tighter text-primary">
                            {formData.brandId || 'Designer Item'}
                        </h3>
                        <p className="text-muted-foreground font-medium">{formData.title}</p>
                    </div>
                    <span className="text-2xl font-bold">€{formData.price}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm pt-2">
                    <div className="space-y-1">
                        <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Condition</p>
                        <p className="font-medium capitalize">{formData.condition?.replace('_', ' ')}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Size</p>
                        <p className="font-medium">{formData.sizeValue || 'N/A'}</p>
                    </div>
                </div>
            </CardContent>
        </Card>

        {selectedAddress && (
            <section className="p-5 bg-background rounded-2xl border flex items-start gap-4 shadow-sm">
                <div className="p-2 bg-muted rounded-full">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-sm">
                    <p className="font-bold uppercase text-[10px] text-muted-foreground tracking-widest mb-1">Shipping From</p>
                    <p className="font-bold text-base">{selectedAddress.fullName}</p>
                    <p className="text-muted-foreground">{selectedAddress.address}, {selectedAddress.city}</p>
                </div>
            </section>
        )}
      </div>

      <div className="flex flex-col gap-4 pt-4">
        <Button 
            className="w-full h-16 text-lg font-bold bg-black text-white hover:bg-black/90 shadow-2xl transition-all active:scale-[0.98]" 
            size="lg" 
            onClick={handlePublish} 
            disabled={isPublishing || hasDeadImages}
        >
          {isPublishing ? "Publishing..." : "Confirm & Publish"}
        </Button>
        <Button 
            variant="ghost" 
            className="w-full h-14 font-semibold text-muted-foreground" 
            size="lg" 
            disabled={isPublishing} 
            onClick={() => goToStep(5)}
        >
          Back to Pricing
        </Button>
      </div>
    </div>
  );
}
