
'use client';
import { useSellForm } from '../SellFormContext';
import { Button } from '@/components/ui/button';
import { Edit2, Loader2, Upload, MapPin, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useStorage, useMemoFirebase } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';
import { ProductService } from '@/services/product.service';
import { validateListingData, notifyNewListing } from '@/app/sell/actions';
import imageCompression from 'browser-image-compression';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

  const handlePublish = async () => {
    if (!user || !firestore || !storage) {
        toast({ variant: "destructive", title: "Authentication required" });
        return;
    }
    
    setIsPublishing(true);
    setError(null);
    setUploadProgress(5);

    try {
      const productId = activeDraft?.id || `prod_${Date.now()}`;
      const images = formData.images || [];
      
      // 1. Server-Side Pre-Validation
      const validation = await validateListingData({
          productId,
          sellerId: user.uid,
          title: formData.title,
          price: formData.price,
          status: 'active'
      });

      if (!validation.success) {
          throw new Error("Server validation failed. Please check your data.");
      }

      const finalImages = [];
      
      // 2. Sequential Upload
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        let finalUrl = img.url;

        if (img.url.startsWith('blob:') || img.file) {
          const fileToUpload = img.file || await (await fetch(img.url)).blob();
          
          const options = { maxSizeMB: 0.7, maxWidthOrHeight: 1280, useWebWorker: true };
          const compressed = await imageCompression(fileToUpload as File, options);
          
          const fileExt = img.type?.split('/')[1] || 'jpg';
          const fileName = `img_${Date.now()}_${i}.${fileExt}`;
          const storagePath = `products/${user.uid}/${productId}/${fileName}`;
          const storageRef = ref(storage, storagePath);
          
          const uploadTask = uploadBytesResumable(storageRef, compressed);

          await new Promise((resolve, reject) => {
            uploadTask.on('state_changed', 
              (snap) => {
                const p = (snap.bytesTransferred / snap.totalBytes) * (80 / images.length);
                setUploadProgress(prev => Math.min(90, Math.max(prev, 5 + (i * (80 / images.length)) + p)));
              },
              reject,
              () => resolve(null)
            );
          });

          finalUrl = await getDownloadURL(storageRef);
        }

        finalImages.push({ url: finalUrl, position: i });
      }

      setUploadProgress(95);

      // 3. Final Firestore Write via Service Layer
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
      
      // 4. Trigger Server Action for notification
      await notifyNewListing(productData.title!, user.displayName || "A user");

      setUploadProgress(100);
      toast({ title: "Listing Published!", variant: "success" });
      setTimeout(() => nextStep(), 500);

    } catch (e: any) {
      console.error("Publish error:", e);
      setError(e.message || "An unexpected error occurred.");
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="text-center">
        <h2 className="text-2xl font-bold font-headline">Final Review</h2>
        <p className="text-muted-foreground">Check your listing before publishing.</p>
      </div>

      {error && (
          <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
          </Alert>
      )}

      <div className="relative aspect-[3/4] rounded-xl overflow-hidden border bg-muted shadow-sm">
        {formData.images?.[0] && (
            <Image 
                src={formData.images[0].url} 
                alt="Main product" 
                fill 
                className="object-cover" 
                unoptimized={formData.images[0].url.startsWith('blob:')}
            />
        )}
        <Button variant="secondary" size="sm" className="absolute bottom-4 right-4" onClick={() => goToStep(1)} disabled={isPublishing}>
          <Edit2 className="h-4 w-4 mr-2" /> Photos
        </Button>
      </div>

      {isPublishing && (
          <div className="space-y-3 bg-primary/5 p-4 rounded-xl border border-primary/20">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-primary">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Publishing...
                  </span>
                  <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
          </div>
      )}

      <div className="space-y-6">
        <section className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-2xl uppercase tracking-tighter">{formData.brandId || 'Designer'}</h3>
            <span className="text-2xl font-bold">€{formData.price}</span>
          </div>
          <p className="text-muted-foreground text-lg">{formData.title}</p>
        </section>

        {selectedAddress && (
            <section className="p-4 bg-muted/20 rounded-xl border flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="font-bold uppercase text-[10px] text-muted-foreground tracking-widest mb-1">Shipping from</p>
                    <p className="font-semibold">{selectedAddress.fullName}</p>
                    <p className="text-xs text-muted-foreground">{selectedAddress.address}, {selectedAddress.city}</p>
                </div>
            </section>
        )}
      </div>

      <div className="flex flex-col gap-3 pt-4">
        <Button 
            className="w-full h-16 text-lg font-bold bg-black text-white hover:bg-black/90 shadow-xl" 
            size="lg" 
            onClick={handlePublish} 
            disabled={isPublishing}
        >
          {isPublishing ? "Processing..." : "Publish Now"}
        </Button>
        <Button variant="outline" className="w-full h-14" size="lg" disabled={isPublishing} onClick={() => goToStep(5)}>
          Go Back
        </Button>
      </div>
    </div>
  );
}
