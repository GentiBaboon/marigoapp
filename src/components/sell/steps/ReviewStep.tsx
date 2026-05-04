'use client';

import * as React from 'react';
import { useSellForm } from '../SellFormContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
    Edit2, 
    Loader2, 
    MapPin, 
    AlertCircle, 
    CheckCircle2, 
    Package, 
    Tag,
    ChevronRight,
    Camera
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { ProductService } from '@/services/product.service';
import { uploadProductImage } from '@/services/image-upload.service';
import { validateListingData, notifyNewListing } from '@/app/sell/actions';
import { collection } from 'firebase/firestore';
import { useCollection } from '@/firebase';
import type { FirestoreAddress, FirestoreProduct } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/context/CurrencyContext';

export function ReviewStep() {
  const { formData, goToStep, nextStep, activeDraft } = useSellForm();
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { formatPrice } = useCurrency();

  const addressesCollection = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'addresses');
  }, [user, firestore]);
  
  const { data: addresses } = useCollection<FirestoreAddress>(addressesCollection);
  const selectedAddress = addresses?.find(a => a.id === formData.shippingFromAddressId);

  /**
   * Resolves an image (File, data URI, blob URL, or https URL) into a Blob for upload.
   * Handles all persistence formats: File objects (live session), data URIs (restored draft),
   * and https URLs (already-uploaded images).
   */
  const resolveImageBlob = async (img: any, retries = 2): Promise<Blob> => {
    // 1. If we still have the original File/Blob in memory, use it directly
    if (img.file instanceof Blob) return img.file;

    // 2. If the URL is a data URI (base64), decode it directly — no network needed
    if (img.url && img.url.startsWith('data:')) {
      const response = await fetch(img.url);
      return await response.blob();
    }

    // 3. For blob: or https: URLs, fetch with retry
    const attemptFetch = async (): Promise<Blob> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch(img.url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.blob();
        } catch (e) {
            clearTimeout(timeoutId);
            throw e;
        }
    };

    for (let i = 0; i <= retries; i++) {
        try {
            return await attemptFetch();
        } catch (e) {
            if (i === retries) throw e;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    throw new Error("Failed to resolve image data.");
  };

  const handlePublish = async () => {
    if (!user || !firestore) {
        toast({ variant: "destructive", title: "Connection Error", description: "Firebase services are not available." });
        return;
    }

    setIsPublishing(true);
    setError(null);
    setUploadProgress(0);
    setStatusMessage('Validating details...');

    try {
      const productId = activeDraft?.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const images = formData.images || [];
      
      if (images.length === 0) throw new Error("At least one photo is required to publish.");

      // 1. Server-Side Validation
      const validation = await validateListingData({
          productId,
          sellerId: user.uid,
          title: formData.title,
          price: formData.price,
          status: 'active'
      });

      if (!validation.success) {
          const firstError = Object.values(validation.errors || {})[0];
          throw new Error(Array.isArray(firstError) ? firstError[0] : "One or more fields are invalid.");
      }

      const finalImages = [];

      // 2. Sequential reliable uploads via Supabase Storage
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const progressBase = (i / images.length) * 85;

        setStatusMessage(`Preparing photo ${i + 1} of ${images.length}...`);
        setUploadProgress(progressBase + 2);

        try {
            const blob = await resolveImageBlob(img);

            setStatusMessage(`Uploading photo ${i + 1}...`);
            const uploaded = await uploadProductImage(
              blob,
              user.uid,
              productId,
              i,
              img.type || 'image/jpeg'
            );

            finalImages.push({ url: uploaded.url, position: i });
            setUploadProgress(progressBase + (85 / images.length));
        } catch (imgErr) {
            console.error(`Failed at image ${i}:`, imgErr);
            throw new Error(`Photo ${i + 1} could not be uploaded. Please try re-uploading your photos.`);
        }
      }

      // 3. Final Firestore Creation
      setStatusMessage('Creating your listing...');
      setUploadProgress(95);

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
        // Available stock — defaults to 1 when the seller didn't change it.
        quantity: Math.max(1, Math.floor(formData.quantity ?? 1)),
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
      
      // Trigger background notification (Non-blocking)
      notifyNewListing(productData.title!, user.displayName || "A member").catch(console.warn);

      setUploadProgress(100);
      setStatusMessage('Listing live!');
      
      // Short delay for user to see success state
      setTimeout(() => nextStep(), 1000);

    } catch (e: any) {
      console.error("Publishing Error:", e);
      setError(e.message || "An unexpected error occurred while publishing your item.");
      setIsPublishing(false);
      setUploadProgress(0);
      setStatusMessage('');
    }
  };

  return (
    <div className="space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold font-headline tracking-tight">Review Listing</h2>
        <p className="text-muted-foreground text-sm">One last look before your item goes live.</p>
      </div>

      {error && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Action Required</AlertTitle>
              <AlertDescription className="mt-2 text-xs">
                  {error}
              </AlertDescription>
          </Alert>
      )}

      {/* Main Preview Card */}
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border shadow-xl bg-muted group">
        {formData.images?.[0] ? (
            <Image 
                src={formData.images[0].url} 
                alt="Product preview" 
                fill 
                className="object-cover transition-transform duration-700 group-hover:scale-105" 
                unoptimized={formData.images[0].url.startsWith('blob:')}
            />
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Camera className="h-12 w-12 mb-2 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest">No preview</p>
            </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">{formData.brandId || 'Designer'}</p>
            <h3 className="text-xl font-bold line-clamp-1">{formData.title || 'Untitled Item'}</h3>
            <p className="text-2xl font-black">{formatPrice(formData.price || 0)}</p>
        </div>

        {!isPublishing && (
            <Button 
                variant="secondary" 
                size="sm" 
                className="absolute top-4 right-4 h-10 px-4 rounded-full shadow-lg bg-white/90 backdrop-blur-sm text-black hover:bg-white font-bold text-xs" 
                onClick={() => goToStep(1)} 
            >
              <Edit2 className="h-3 w-3 mr-2" /> Photos
            </Button>
        )}
      </div>

      {/* Publishing Progress */}
      {isPublishing && (
          <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-primary">
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {statusMessage}
                      </span>
                      <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-1.5" />
              </CardContent>
          </Card>
      )}

      {/* Item Summary */}
      <div className="space-y-4">
        <Card className="border-none bg-muted/30">
            <CardContent className="p-5 space-y-5">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <p className="text-muted-foreground uppercase text-[9px] font-black tracking-widest">Condition</p>
                        <p className="font-bold text-sm capitalize">{formData.condition?.replace('_', ' ') || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-muted-foreground uppercase text-[9px] font-black tracking-widest">Size</p>
                        <p className="font-bold text-sm">{formData.sizeValue || 'O/S'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-muted-foreground uppercase text-[9px] font-black tracking-widest">Material</p>
                        <p className="font-bold text-sm capitalize">{formData.material || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-muted-foreground uppercase text-[9px] font-black tracking-widest">Color</p>
                        <p className="font-bold text-sm capitalize">{formData.color || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-muted-foreground uppercase text-[9px] font-black tracking-widest">Quantity</p>
                        <p className="font-bold text-sm">{Math.max(1, Math.floor(formData.quantity ?? 1))}</p>
                    </div>
                </div>
                
                <div className="pt-4 border-t border-muted-foreground/10">
                    <div className="flex justify-between items-center">
                        <div className="space-y-0.5">
                            <p className="text-muted-foreground uppercase text-[9px] font-black tracking-widest">Pricing</p>
                            <p className="text-sm font-medium">15% platform fee applies</p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-primary font-bold text-xs" onClick={() => goToStep(5)}>Edit</Button>
                    </div>
                </div>
            </CardContent>
        </Card>

        {selectedAddress && (
            <div className="p-4 bg-background rounded-xl border flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/5 rounded-full">
                        <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-xs">
                        <p className="font-black uppercase text-[8px] text-muted-foreground tracking-widest mb-0.5">Shipping From</p>
                        <p className="font-bold">{selectedAddress.fullName}</p>
                        <p className="text-muted-foreground">{selectedAddress.city}, {selectedAddress.country}</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => goToStep(5)}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col gap-3 pt-4">
        <Button 
            className={cn(
                "w-full h-16 text-base font-bold shadow-xl transition-all active:scale-[0.98] rounded-full",
                isPublishing ? "bg-muted text-muted-foreground" : "bg-black text-white hover:bg-black/90"
            )} 
            size="lg" 
            onClick={handlePublish} 
            disabled={isPublishing}
        >
          {isPublishing ? (
              <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Publishing...</span>
              </span>
          ) : (
              <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Confirm & Publish
              </span>
          )}
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
