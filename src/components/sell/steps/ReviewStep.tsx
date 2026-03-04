
'use client';
import { useSellForm } from '../SellFormContext';
import { Button } from '@/components/ui/button';
import { Edit2, Loader2, Upload, MapPin, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useStorage } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';
import type { FirestoreProduct, FirestoreAddress } from '@/lib/types';
import { useCollection, useMemoFirebase } from '@/firebase';
import imageCompression from 'browser-image-compression';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
      
      if (images.length < 3) throw new Error("Please upload at least 3 photos");

      const finalImages: { url: string; thumbnailUrl: string; position: number }[] = [];
      
      // Sequential upload for stability
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        let finalUrl = img.url;

        // Determine if we need to upload
        const isLocal = img.url.startsWith('blob:') || img.url.startsWith('data:');
        const fileObject = (img as any).file;

        if (isLocal || fileObject) {
          let fileToUpload: File | Blob;
          
          try {
            // Priority 1: Use the actual File object if available (most stable)
            if (fileObject instanceof File || fileObject instanceof Blob) {
              fileToUpload = fileObject;
            } else {
              // Priority 2: Try to fetch the blob URL
              const response = await fetch(img.url);
              if (!response.ok) throw new Error("Local image data has expired. Please re-upload photos.");
              fileToUpload = await response.blob();
            }
            
            // Step A: Compression
            setUploadProgress(prev => Math.max(prev, 5 + (i * (90 / images.length))));
            const options = { maxSizeMB: 0.7, maxWidthOrHeight: 1280, useWebWorker: true };
            const compressed = await imageCompression(fileToUpload as File, options);
            
            // Step B: Upload to Storage
            const fileExt = img.type?.split('/')[1] || 'jpg';
            const fileName = `img_${Date.now()}_${i}.${fileExt}`;
            const storagePath = `products/${user.uid}/${productId}/${fileName}`;
            const storageRef = ref(storage, storagePath);
            
            const uploadTask = uploadBytesResumable(storageRef, compressed, {
              contentType: img.type || 'image/jpeg'
            });

            await new Promise((resolve, reject) => {
              uploadTask.on('state_changed', 
                (snapshot) => {
                  const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * (80 / images.length);
                  setUploadProgress(prev => {
                      const base = 5 + (i * (80 / images.length));
                      return Math.min(90, Math.max(prev, base + progress));
                  });
                },
                (error) => reject(error),
                () => resolve(null)
              );
            });

            finalUrl = await getDownloadURL(storageRef);
          } catch (imgError: any) {
            console.error(`Error processing image ${i}:`, imgError);
            throw new Error(imgError.message || `Failed to process image ${i + 1}.`);
          }
        }

        finalImages.push({
          url: finalUrl,
          thumbnailUrl: finalUrl,
          position: i
        });
      }

      setUploadProgress(95);

      // Final Firestore Document
      const productData: FirestoreProduct = {
        id: productId,
        sellerId: user.uid,
        title: formData.title || 'Untitled',
        description: formData.description || '',
        categoryId: formData.categoryId || 'uncategorized',
        subcategoryId: formData.subcategoryId || 'uncategorized',
        brandId: formData.brandId || 'other',
        condition: (formData.condition as any) || 'good',
        listingType: formData.listingType || 'fixed_price',
        price: formData.price || 0,
        originalPrice: formData.originalPrice,
        currency: 'EUR',
        size: formData.sizeValue || formData.size,
        color: formData.color,
        material: formData.material,
        gender: (formData.gender as any) || 'unisex',
        images: finalImages,
        status: 'active',
        views: 0,
        wishlistCount: 0,
        isFeatured: false,
        isAuthenticated: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        listingCreated: serverTimestamp(),
        shippingFromAddressId: formData.shippingFromAddressId,
      };

      const productRef = doc(firestore, 'products', productId);
      await setDoc(productRef, productData);
      
      setUploadProgress(100);
      toast({ title: "Listing Published!", variant: "success" });
      
      setTimeout(() => nextStep(), 500);

    } catch (e: any) {
      console.error("Publish error:", e);
      setError(e.message || "An unexpected error occurred while publishing.");
      setIsPublishing(false);
      setUploadProgress(0);
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
                alt="Main product view" 
                fill 
                className="object-cover" 
                unoptimized={formData.images[0].url.startsWith('blob:')}
            />
        )}
        <Button variant="secondary" size="sm" className="absolute bottom-4 right-4" onClick={() => goToStep(1)} disabled={isPublishing}>
          <Edit2 className="h-4 w-4 mr-2" /> Change Photos
        </Button>
      </div>

      {isPublishing && (
          <div className="space-y-3 bg-primary/5 p-4 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-primary">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing & Uploading...
                  </span>
                  <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-[10px] text-center text-muted-foreground uppercase">Please wait while we secure your listing</p>
          </div>
      )}

      <div className="space-y-6">
        <section className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-2xl uppercase tracking-tighter">{formData.brandId || 'Designer'}</h3>
            <span className="text-2xl font-bold">€{formData.price}</span>
          </div>
          <p className="text-muted-foreground text-lg">{formData.title}</p>
          <div className="flex gap-2">
            <span className="bg-muted px-2 py-1 rounded text-[10px] uppercase font-bold border">{formData.condition?.replace('_', ' ')}</span>
            {formData.sizeValue && <span className="bg-muted px-2 py-1 rounded text-[10px] uppercase font-bold border">{formData.sizeValue}</span>}
          </div>
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
          {isPublishing ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Publishing...</>
          ) : (
              <><Upload className="h-5 w-5 mr-2" /> Publish Now</>
          )}
        </Button>
        <Button variant="outline" className="w-full h-14 text-muted-foreground" size="lg" disabled={isPublishing} onClick={() => goToStep(5)}>
          Go Back
        </Button>
      </div>
    </div>
  );
}
