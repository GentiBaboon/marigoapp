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

  const handlePublish = async () => {
    if (!user || !firestore || !storage) {
        toast({ variant: "destructive", title: "Authentication required" });
        return;
    }

    setIsPublishing(true);
    setError(null);
    setUploadProgress(0);
    setStatusMessage('Validating listing...');

    try {
      const productId = activeDraft?.id || `prod_${Date.now()}`;
      const images = formData.images || [];
      
      // 1. Server-Side Validation (Price, Title, etc.)
      const validation = await validateListingData({
          productId,
          sellerId: user.uid,
          title: formData.title,
          price: formData.price,
          status: 'active'
      });

      if (!validation.success) {
          const firstError = Object.values(validation.errors || {})[0];
          throw new Error(Array.isArray(firstError) ? firstError[0] : "Please check your title and price.");
      }

      const finalImages = [];
      
      // 2. Sequential Upload
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        let finalUrl = img.url;

        // If it's a local file (from PhotosStep), upload it
        if (img.file) {
          setStatusMessage(`Uploading image ${i + 1} of ${images.length}...`);
          
          const fileExt = img.type?.split('/')[1] || 'jpg';
          const fileName = `img_${Date.now()}_${i}.${fileExt}`;
          const storagePath = `products/${user.uid}/${productId}/${fileName}`;
          const storageRef = ref(storage, storagePath);
          
          const metadata = {
              contentType: img.type || 'image/jpeg',
              customMetadata: {
                  originalName: img.name || 'product_image'
              }
          };

          const uploadTask = uploadBytesResumable(storageRef, img.file, metadata);

          await new Promise((resolve, reject) => {
              uploadTask.on('state_changed', 
                (snap) => {
                    const chunkWeight = 90 / images.length;
                    const fileProgress = (snap.bytesTransferred / (snap.totalBytes || 1)) * chunkWeight;
                    const baseProgress = (i * chunkWeight);
                    setUploadProgress(Math.min(90, baseProgress + fileProgress));
                },
                (err) => reject(new Error(`Storage error: ${err.message}`)),
                () => resolve(null)
              );
          });

          finalUrl = await getDownloadURL(storageRef);
        }

        finalImages.push({ url: finalUrl, position: i });
      }

      // 3. Final Firestore Write via Service Layer
      setStatusMessage('Making listing live...');
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
      
      // Async notification (don't block UI)
      notifyNewListing(productData.title!, user.displayName || "A user").catch(console.warn);

      setUploadProgress(100);
      setStatusMessage('Published!');
      
      setTimeout(() => nextStep(), 800);

    } catch (e: any) {
      setError(e.message || "An unexpected error occurred during publishing.");
      setIsPublishing(false);
      setUploadProgress(0);
      setStatusMessage('');
    }
  };

  return (
    <div className="space-y-8 pb-24 max-w-lg mx-auto animate-in fade-in duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold font-headline">Review</h2>
        <p className="text-muted-foreground text-sm">Everything looks perfect. Ready to list?</p>
      </div>

      {error && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Publishing Failed</AlertTitle>
              <AlertDescription className="mt-2">
                  {error}
              </AlertDescription>
          </Alert>
      )}

      {/* Main Image Preview */}
      <div className="relative aspect-[3/4] rounded-3xl overflow-hidden border-2 bg-muted shadow-2xl group">
        {formData.images?.[0] ? (
            <Image 
                src={formData.images[0].url} 
                alt="Listing preview" 
                fill 
                className="object-cover transition-transform duration-700 group-hover:scale-105" 
                unoptimized={formData.images[0].url.startsWith('blob:')}
            />
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <AlertCircle className="h-10 w-10 mb-2 opacity-20" />
                <p>No photos selected</p>
            </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <Button 
            variant="secondary" 
            size="sm" 
            className="absolute bottom-6 right-6 h-12 px-6 rounded-full shadow-xl bg-white text-black hover:bg-gray-100 font-bold" 
            onClick={() => goToStep(1)} 
            disabled={isPublishing}
        >
          <Edit2 className="h-4 w-4 mr-2" /> Edit Photos
        </Button>
      </div>

      {/* Upload Status Card */}
      {isPublishing && (
          <Card className="border-primary/20 bg-primary/5 shadow-inner">
              <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {statusMessage}
                      </span>
                      <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2 bg-primary/10" />
              </CardContent>
          </Card>
      )}

      {/* Details Summary */}
      <div className="space-y-4">
        <Card className="border-none bg-muted/30 shadow-sm rounded-2xl">
            <CardContent className="p-6 space-y-6">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <h3 className="font-bold text-2xl uppercase tracking-tighter text-primary">
                            {formData.brandId || 'Boutique'}
                        </h3>
                        <p className="text-muted-foreground font-medium line-clamp-1">{formData.title || 'Product'}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-black">€{formData.price}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Fixed Price</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6 pt-2 border-t border-muted-foreground/10">
                    <div className="space-y-1">
                        <p className="text-muted-foreground uppercase text-[9px] font-black tracking-widest">Condition</p>
                        <p className="font-bold capitalize text-sm">{formData.condition?.replace('_', ' ') || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-muted-foreground uppercase text-[9px] font-black tracking-widest">Size</p>
                        <p className="font-bold text-sm">{formData.sizeValue || 'One Size'}</p>
                    </div>
                </div>
            </CardContent>
        </Card>

        {selectedAddress && (
            <div className="p-5 bg-background rounded-2xl border flex items-start gap-4 shadow-sm">
                <div className="p-3 bg-muted rounded-full shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="text-sm overflow-hidden">
                    <p className="font-black uppercase text-[9px] text-muted-foreground tracking-widest mb-1">Shipping From</p>
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
                "w-full h-16 text-lg font-bold shadow-2xl transition-all active:scale-[0.98] rounded-full",
                isPublishing ? "bg-muted text-muted-foreground" : "bg-black text-white hover:bg-black/90"
            )} 
            size="lg" 
            onClick={handlePublish} 
            disabled={isPublishing}
        >
          {isPublishing ? (
              <span className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Listing Item...
              </span>
          ) : "Confirm & List Item"}
        </Button>
        <Button 
            variant="ghost" 
            className="w-full h-12 font-bold text-muted-foreground hover:text-foreground uppercase tracking-widest text-[10px]" 
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
