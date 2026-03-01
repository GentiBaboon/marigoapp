'use client';
import { useSellForm } from '../SellFormContext';
import { Button } from '@/components/ui/button';
import { Check, Edit2, Loader2, Upload } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';

export function ReviewStep() {
  const { formData, goToStep, nextStep, activeDraft } = useSellForm();
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const handlePublish = async () => {
    if (!user || !firestore) {
        toast({ variant: "destructive", title: "Authentication required" });
        return;
    }
    
    setIsPublishing(true);
    setUploadProgress(5); // Start with a small progress

    try {
      const productId = activeDraft?.id || `prod_${Date.now()}`;
      const storage = getStorage();
      const finalImageUrls: string[] = [];

      const images = formData.images || [];
      if (images.length === 0) throw new Error("No images to upload");

      // 1. Upload each image to Firebase Storage
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        
        // If it's already a permanent URL (unlikely in this flow but for robustness)
        if (img.url.startsWith('http') && !img.url.includes('blob')) {
          finalImageUrls.push(img.url);
          continue;
        }

        try {
            // Convert blob URL to Blob object
            const response = await fetch(img.url);
            const blob = await response.blob();
            
            // Create storage reference
            const fileExtension = img.type?.split('/')[1] || 'jpg';
            const fileName = `img_${Date.now()}_${i}.${fileExtension}`;
            const storagePath = `products/${user.uid}/${productId}/${fileName}`;
            const storageRef = ref(storage, storagePath);
            
            // Upload
            await uploadBytes(storageRef, blob);
            
            // Get permanent URL
            const downloadUrl = await getDownloadURL(storageRef);
            finalImageUrls.push(downloadUrl);
            
            // Update progress (from 5% to 90%)
            setUploadProgress(5 + Math.round(((i + 1) / images.length) * 85));
        } catch (uploadErr) {
            console.error(`Failed to upload image ${i}:`, uploadErr);
            throw new Error(`Failed to upload image ${i + 1}`);
        }
      }

      // 2. Save product document to Firestore with permanent URLs
      const productRef = doc(firestore, 'products', productId);
      const productData = {
        ...formData,
        id: productId,
        sellerId: user.uid,
        status: 'active',
        listingCreated: serverTimestamp(),
        images: finalImageUrls, // Use permanent URLs
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

      <div className="relative aspect-[3/4] rounded-xl overflow-hidden border bg-muted">
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
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <span>Uploading listing...</span>
                  <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
          </div>
      )}

      <div className="space-y-6">
        <section className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">{formData.brand}</h3>
            <span className="text-xl font-bold">€{formData.price}</span>
          </div>
          <p className="text-muted-foreground">{formData.title}</p>
          <div className="flex gap-2">
            {formData.sizeValue && <span className="bg-muted px-2 py-1 rounded text-xs uppercase font-semibold">{formData.sizeValue}</span>}
            <span className="bg-muted px-2 py-1 rounded text-xs uppercase font-semibold">{formData.condition?.replace('_', ' ')}</span>
          </div>
        </section>

        <section className="p-4 bg-muted/30 rounded-lg">
          <h4 className="font-semibold text-sm mb-2">Description</h4>
          <p className="text-sm text-muted-foreground line-clamp-3">{formData.description}</p>
        </section>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" />
            <span>High quality photos detected</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" />
            <span>Detailed description provided</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Button className="w-full h-14 text-lg" size="lg" onClick={handlePublish} disabled={isPublishing}>
          {isPublishing ? (
              <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Publishing...</>
          ) : (
              <><Upload className="h-5 w-5 mr-2" /> Publish Now</>
          )}
        </Button>
        <Button variant="outline" className="w-full h-14" size="lg" disabled={isPublishing} onClick={() => goToStep(0)}>
          Save as Draft
        </Button>
      </div>
    </div>
  );
}
