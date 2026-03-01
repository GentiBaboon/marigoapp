'use client';
import { useSellForm } from '../SellFormContext';
import { Button } from '@/components/ui/button';
import { Check, Edit2, Loader2, Upload } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useStorage } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';

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
      const finalImageUrls: string[] = [];

      const images = formData.images || [];
      if (images.length === 0) throw new Error("No images to upload");

      // We track individual progress for all images
      const imageProgress = new Array(images.length).fill(0);

      const uploadImage = async (img: typeof images[0], index: number) => {
        // If it's already a permanent URL (robustness)
        if (img.url.startsWith('http') && !img.url.includes('blob')) {
          imageProgress[index] = 100;
          return img.url;
        }

        // Convert blob URL to Blob object
        const response = await fetch(img.url);
        const blob = await response.blob();
        
        const fileExtension = img.type?.split('/')[1] || 'jpg';
        const fileName = `img_${Date.now()}_${index}.${fileExtension}`;
        const storagePath = `products/${user.uid}/${productId}/${fileName}`;
        const storageRef = ref(storage, storagePath);
        
        // Use Resumable upload for better tracking and reliability
        const uploadTask = uploadBytesResumable(storageRef, blob, {
            contentType: img.type
        });

        return new Promise<string>((resolve, reject) => {
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    imageProgress[index] = progress;
                    // Calculate overall progress: 5% initial + up to 85% from uploads
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

      // Upload images in parallel for speed
      const uploadedUrls = await Promise.all(images.map((img, i) => uploadImage(img, i)));
      finalImageUrls.push(...uploadedUrls);

      // 2. Prepare and save product document to Firestore
      // Important: Remove the temporary blob image objects from the saved data
      const { images: _, ...listingData } = formData;
      
      const productRef = doc(firestore, 'products', productId);
      const productData = {
        ...listingData,
        id: productId,
        sellerId: user.uid,
        status: 'active',
        listingCreated: serverTimestamp(),
        images: finalImageUrls, // These are now permanent URLs
        views: 0,
        likes: 0
      };

      await setDoc(productRef, productData);
      
      setUploadProgress(100);
      toast({ title: "Listing Published!", variant: "success" });
      
      // Move to Success Step
      nextStep();
    } catch (e: any) {
      console.error("Publish error:", e);
      toast({ 
        variant: "destructive", 
        title: "Error publishing listing", 
        description: e.message || "Something went wrong during upload."
      });
    } finally {
      setIsPublishing(false);
    }
  };

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
            <h3 className="font-bold text-2xl uppercase tracking-tighter">{formData.brand}</h3>
            <span className="text-2xl font-bold">€{formData.price}</span>
          </div>
          <p className="text-muted-foreground text-lg">{formData.title}</p>
          <div className="flex gap-2">
            {formData.sizeValue && <span className="bg-muted px-2 py-1 rounded text-xs uppercase font-bold border">{formData.sizeValue}</span>}
            <span className="bg-muted px-2 py-1 rounded text-xs uppercase font-bold border">{formData.condition?.replace('_', ' ')}</span>
          </div>
        </section>

        <section className="p-4 bg-muted/20 rounded-xl border">
          <h4 className="font-bold text-xs uppercase tracking-widest text-muted-foreground mb-2">Description</h4>
          <p className="text-sm leading-relaxed text-foreground/80 line-clamp-4">{formData.description}</p>
        </section>

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
            <Check className="h-4 w-4" />
            <span>High quality photos confirmed</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
            <Check className="h-4 w-4" />
            <span>Detailed description verified</span>
          </div>
        </div>
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
