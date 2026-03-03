'use client';
import { useSellForm } from '../SellFormContext';
import { Button } from '@/components/ui/button';
import { Edit2, Loader2, Upload } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useStorage, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';
import type { FirestoreProduct } from '@/lib/types';
import imageCompression from 'browser-image-compression';

export function ReviewStep() {
  const { formData, goToStep, nextStep, activeDraft } = useSellForm();
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();

  const handlePublish = async () => {
    if (!user || !firestore || !storage) {
        toast({ variant: "destructive", title: "Authentication required" });
        return;
    }
    
    setIsPublishing(true);
    setUploadProgress(5);

    try {
      const productId = activeDraft?.id || `prod_${Date.now()}`;
      const finalImages: FirestoreProduct['images'] = [];

      const images = formData.images || [];
      if (images.length === 0) throw new Error("No images to upload");

      const imageProgress = new Array(images.length).fill(0);

      const uploadImage = async (img: typeof images[0], index: number) => {
        const response = await fetch(img.url);
        let blob = await response.blob();
        
        // Optimized Compression
        if (img.url.startsWith('blob:')) {
            const options = {
                maxSizeMB: 0.8,
                maxWidthOrHeight: 1200,
                useWebWorker: true,
            };
            try {
                const compressedFile = await imageCompression(blob as File, options);
                blob = compressedFile;
            } catch (error) {
                console.warn("Compression failed, uploading original", error);
            }
        }

        const fileExtension = img.type?.split('/')[1] || 'jpg';
        const fileName = `img_${Date.now()}_${index}.${fileExtension}`;
        const storagePath = `products/${user.uid}/${productId}/${fileName}`;
        const storageRef = ref(storage, storagePath);
        
        const uploadTask = uploadBytesResumable(storageRef, blob, {
            contentType: img.type || 'image/jpeg'
        });

        return new Promise<string>((resolve, reject) => {
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    imageProgress[index] = progress;
                    const totalLoaded = imageProgress.reduce((a, b) => a + b, 0);
                    const averageProgress = totalLoaded / images.length;
                    setUploadProgress(5 + Math.round(averageProgress * 0.85));
                }, 
                (error) => reject(error), 
                async () => {
                    const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(downloadUrl);
                }
            );
        });
      };

      const uploadedUrls = await Promise.all(images.map((img, i) => uploadImage(img, i)));
      
      uploadedUrls.forEach((url, i) => {
          finalImages.push({
              url,
              thumbnailUrl: url,
              position: i
          });
      });

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
        listingCreated: serverTimestamp(), // CRITICAL for visibility in homepage/search
      };

      const productRef = doc(firestore, 'products', productId);
      
      // Pattern non-blocking con catch per errori contestuali
      setDoc(productRef, productData)
        .then(() => {
            setUploadProgress(100);
            toast({ title: "Listing Published!", variant: "success" });
            nextStep();
        })
        .catch(async (error) => {
            const permissionError = new FirestorePermissionError({
                path: productRef.path,
                operation: 'create',
                requestResourceData: productData,
            });
            errorEmitter.emit('permission-error', permissionError);
            setIsPublishing(false);
        });

    } catch (e: any) {
      console.error("Publish error:", e);
      toast({ 
        variant: "destructive", 
        title: "Error publishing listing", 
        description: e.message || "Something went wrong during upload."
      });
      setIsPublishing(false);
    }
  };

  const brandName = formData.brandId || 'Designer Item';

  return (
    <div className="space-y-8 pb-20">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Almost there!</h2>
        <p className="text-muted-foreground">Review your listing details before going live.</p>
      </div>

      <div className="relative aspect-[3/4] rounded-xl overflow-hidden border bg-muted shadow-sm">
        {formData.images?.[0] && (
            <Image 
                src={formData.images[0].url} 
                alt="Main" 
                fill 
                className="object-cover" 
                unoptimized={formData.images[0].url.startsWith('blob:')}
            />
        )}
        <Button variant="secondary" size="sm" className="absolute bottom-4 right-4" onClick={() => goToStep(1)}>
          <Edit2 className="h-4 w-4 mr-2" /> Edit Photos
        </Button>
      </div>

      {isPublishing && (
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-primary">
                  <span>Uploading listing...</span>
                  <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
          </div>
      )}

      <div className="space-y-6">
        <section className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-2xl uppercase tracking-tighter">{brandName}</h3>
            <span className="text-2xl font-bold">€{formData.price}</span>
          </div>
          <p className="text-muted-foreground text-lg">{formData.title}</p>
          <div className="flex gap-2">
            {formData.sizeValue && <span className="bg-muted px-2 py-1 rounded text-[10px] uppercase font-bold border">{formData.sizeValue}</span>}
            <span className="bg-muted px-2 py-1 rounded text-[10px] uppercase font-bold border">{formData.condition?.replace('_', ' ')}</span>
          </div>
        </section>

        <section className="p-4 bg-muted/20 rounded-xl border">
          <h4 className="font-bold text-xs uppercase tracking-widest text-muted-foreground mb-2">Description</h4>
          <p className="text-sm leading-relaxed text-foreground/80 line-clamp-4">{formData.description}</p>
        </section>
      </div>

      <div className="flex flex-col gap-3 pt-4">
        <Button className="w-full h-14 text-lg font-bold bg-black text-white hover:bg-black/90" size="lg" onClick={handlePublish} disabled={isPublishing}>
          {isPublishing ? (
              <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Publishing...</>
          ) : (
              <><Upload className="h-5 w-5 mr-2" /> Publish Now</>
          )}
        </Button>
        <Button variant="outline" className="w-full h-14 text-lg font-medium" size="lg" disabled={isPublishing} onClick={() => goToStep(0)}>
          Save as Draft
        </Button>
      </div>
    </div>
  );
}
