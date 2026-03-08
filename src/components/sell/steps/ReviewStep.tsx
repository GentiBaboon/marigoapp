'use client';
import { useSellForm } from '../SellFormContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Edit2, Loader2, MapPin, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
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

  // Check for stale blobs (happens on refresh or long idle)
  const deadBlobs = formData.images?.filter(img => img.url.startsWith('blob:') && !img.file) || [];
  const hasDeadImages = deadBlobs.length > 0;

  const handlePublish = async () => {
    if (!user || !firestore || !storage) {
        toast({ variant: "destructive", title: "Authentication required" });
        return;
    }

    if (hasDeadImages) {
        setError("Your image previews have expired. Please go back to the Photos step and re-upload your items.");
        return;
    }
    
    setIsPublishing(true);
    setError(null);
    setUploadProgress(0);
    setStatusMessage('Validating listing data...');

    try {
      const productId = activeDraft?.id || `prod_${Date.now()}`;
      const images = formData.images || [];
      
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
          throw new Error(Array.isArray(firstError) ? firstError[0] : "Server validation failed. Please check your title and price.");
      }

      setUploadProgress(10);
      const finalImages = [];
      
      // 2. Sequential Upload with Explicit Metadata
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        let finalUrl = img.url;

        if (img.url.startsWith('blob:') || img.file) {
          setStatusMessage(`Processing image ${i + 1} of ${images.length}...`);
          
          try {
            // Get file source
            const fileToUpload = img.file || await (await fetch(img.url)).blob();
            
            // Compression
            const compressionOptions = { 
                maxSizeMB: 0.7, 
                maxWidthOrHeight: 1600, 
                useWebWorker: true 
            };
            const compressed = await imageCompression(fileToUpload as File, compressionOptions);
            
            // Storage Ref
            const fileExt = img.type?.split('/')[1] || 'jpg';
            const fileName = `img_${Date.now()}_${i}.${fileExt}`;
            const storagePath = `products/${user.uid}/${productId}/${fileName}`;
            const storageRef = ref(storage, storagePath);
            
            // Metadata is CRITICAL for Security Rules
            const metadata = {
                contentType: img.type || 'image/jpeg',
                customMetadata: {
                    originalName: img.name || 'product_image'
                }
            };

            const uploadTask = uploadBytesResumable(storageRef, compressed, metadata);

            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', 
                (snap) => {
                    const chunkWeight = 80 / images.length;
                    const fileProgress = (snap.bytesTransferred / (snap.totalBytes || 1)) * chunkWeight;
                    const baseProgress = 10 + (i * chunkWeight);
                    setUploadProgress(Math.min(90, baseProgress + fileProgress));
                },
                (err) => reject(new Error(`Storage error: ${err.message}`)),
                () => resolve(null)
                );
            });

            finalUrl = await getDownloadURL(storageRef);
          } catch (fileErr: any) {
              throw new Error(`Failed to upload image ${i+1}. Please try a smaller file.`);
          }
        }

        finalImages.push({ url: finalUrl, position: i });
      }

      // 3. Final Firestore Write
      setStatusMessage('Finalizing listing...');
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
      
      // Async notify
      notifyNewListing(productData.title!, user.displayName || "A user").catch(console.warn);

      setUploadProgress(100);
      setStatusMessage('Listing live!');
      
      setTimeout(() => nextStep(), 1000);

    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
      setIsPublishing(false);
      setUploadProgress(0);
      setStatusMessage('');
    }
  };

  return (
    <div className="space-y-8 pb-20 max-w-lg mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold font-headline">Preview</h2>
        <p className="text-muted-foreground text-sm">Review your listing one last time.</p>
      </div>

      {error && (
          <Alert variant="destructive" className="animate-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Publishing Error</AlertTitle>
              <AlertDescription className="space-y-3">
                  <p>{error}</p>
                  <Button variant="outline" size="sm" onClick={() => goToStep(1)}>
                      <RefreshCw className="mr-2 h-3 w-3" /> Re-upload Photos
                  </Button>
              </AlertDescription>
          </Alert>
      )}

      {/* Main Image Preview */}
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border-2 bg-muted shadow-xl group">
        {formData.images?.[0] ? (
            <Image 
                src={formData.images[0].url} 
                alt="Product preview" 
                fill 
                className="object-cover" 
                unoptimized={formData.images[0].url.startsWith('blob:')}
            />
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <AlertCircle className="h-10 w-10 mb-2 opacity-20" />
                <p>No main image set</p>
            </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <Button 
            variant="secondary" 
            size="sm" 
            className="absolute bottom-4 right-4 h-10 px-4 rounded-full shadow-lg" 
            onClick={() => goToStep(1)} 
            disabled={isPublishing}
        >
          <Edit2 className="h-4 w-4 mr-2" /> Change Photos
        </Button>
      </div>

      {/* Upload Status Card */}
      {isPublishing && (
          <Card className="border-primary/20 bg-primary/5 animate-pulse">
              <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-primary">
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

      {/* Details Summary */}
      <div className="space-y-4">
        <Card className="border-none bg-muted/20 shadow-sm">
            <CardContent className="p-6 space-y-6">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <h3 className="font-bold text-2xl uppercase tracking-tighter text-primary">
                            {formData.brandId || 'Designer'}
                        </h3>
                        <p className="text-muted-foreground font-medium">{formData.title || 'Untitled Listing'}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold">€{formData.price}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Fixed Price</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6 pt-2">
                    <div className="space-y-1">
                        <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Condition</p>
                        <p className="font-semibold capitalize text-sm">{formData.condition?.replace('_', ' ') || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Size</p>
                        <p className="font-semibold text-sm">{formData.sizeValue || 'N/A'}</p>
                    </div>
                </div>
            </CardContent>
        </Card>

        {selectedAddress && (
            <div className="p-5 bg-background rounded-2xl border flex items-start gap-4 shadow-sm">
                <div className="p-2.5 bg-muted rounded-full shrink-0">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-sm overflow-hidden">
                    <p className="font-bold uppercase text-[10px] text-muted-foreground tracking-widest mb-1">Shipping From</p>
                    <p className="font-bold text-base truncate">{selectedAddress.fullName}</p>
                    <p className="text-muted-foreground truncate">{selectedAddress.address}, {selectedAddress.city}</p>
                </div>
            </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col gap-4 pt-4">
        <Button 
            className={cn(
                "w-full h-16 text-lg font-bold shadow-2xl transition-all active:scale-[0.98]",
                isPublishing ? "bg-muted text-muted-foreground" : "bg-black text-white hover:bg-black/90"
            )} 
            size="lg" 
            onClick={handlePublish} 
            disabled={isPublishing || hasDeadImages}
        >
          {isPublishing ? (
              <span className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Publishing...
              </span>
          ) : "Confirm & Publish Now"}
        </Button>
        <Button 
            variant="ghost" 
            className="w-full h-12 font-semibold text-muted-foreground hover:text-foreground" 
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
