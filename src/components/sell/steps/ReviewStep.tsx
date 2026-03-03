
'use client';
import { useSellForm } from '../SellFormContext';
import { Button } from '@/components/ui/button';
import { Edit2, Loader2, Upload, MapPin } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useStorage, errorEmitter, FirestorePermissionError, useCollection, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';
import type { FirestoreProduct, FirestoreAddress } from '@/lib/types';
import imageCompression from 'browser-image-compression';

export function ReviewStep() {
  const { formData, goToStep, nextStep, activeDraft } = useSellForm();
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
        toast({ variant: "destructive", title: "Autenticazione richiesta" });
        return;
    }
    
    setIsPublishing(true);
    setUploadProgress(10);

    try {
      const productId = activeDraft?.id || `prod_${Date.now()}`;
      const images = formData.images || [];
      
      if (images.length === 0) throw new Error("Caricare almeno 3 foto");

      // Verify all images are uploaded to Storage
      const finalImages: FirestoreProduct['images'] = [];
      
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        let finalUrl = img.url;

        // If it's still a local blob (should not happen with new PhotosStep, but for safety)
        if (img.url.startsWith('blob:')) {
          const response = await fetch(img.url);
          const blob = await response.blob();
          const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1200 };
          const compressed = await imageCompression(blob as File, options);
          
          const fileExt = img.type?.split('/')[1] || 'jpg';
          const fileName = `final_img_${Date.now()}_${i}.${fileExt}`;
          const storagePath = `products/${user.uid}/${productId}/${fileName}`;
          const storageRef = ref(storage, storagePath);
          
          await uploadBytesResumable(storageRef, compressed);
          finalUrl = await getDownloadURL(storageRef);
        }

        finalImages.push({
          url: finalUrl,
          thumbnailUrl: finalUrl,
          position: i
        });
        
        setUploadProgress(10 + Math.round(((i + 1) / images.length) * 40));
      }

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
      
      setUploadProgress(80);
      
      await setDoc(productRef, productData);
      
      setUploadProgress(100);
      toast({ title: "Annuncio Pubblicato!", variant: "success" });
      nextStep();

    } catch (e: any) {
      console.error("Publish error:", e);
      toast({ 
        variant: "destructive", 
        title: "Errore pubblicazione", 
        description: e.message || "Qualcosa è andato storto."
      });
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Quasi fatto!</h2>
        <p className="text-muted-foreground">Controlla i dettagli del tuo annuncio prima di andare online.</p>
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
          <Edit2 className="h-4 w-4 mr-2" /> Modifica Foto
        </Button>
      </div>

      {isPublishing && (
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-primary">
                  <span>Pubblicazione in corso...</span>
                  <span>{uploadProgress}%</span>
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
          <div className="flex gap-2">
            {formData.sizeValue && <span className="bg-muted px-2 py-1 rounded text-[10px] uppercase font-bold border">{formData.sizeValue}</span>}
            <span className="bg-muted px-2 py-1 rounded text-[10px] uppercase font-bold border">{formData.condition?.replace('_', ' ')}</span>
          </div>
        </section>

        {selectedAddress && (
            <section className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                <h4 className="font-bold text-xs uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
                    <MapPin className="h-3 w-3" /> Spedizione da
                </h4>
                <p className="text-sm font-semibold">{selectedAddress.fullName}</p>
                <p className="text-xs text-muted-foreground">{selectedAddress.address}, {selectedAddress.city}</p>
            </section>
        )}

        <section className="p-4 bg-muted/20 rounded-xl border">
          <h4 className="font-bold text-xs uppercase tracking-widest text-muted-foreground mb-2">Descrizione</h4>
          <p className="text-sm leading-relaxed text-foreground/80 line-clamp-4">{formData.description}</p>
        </section>
      </div>

      <div className="flex flex-col gap-3 pt-4">
        <Button className="w-full h-14 text-lg font-bold bg-black text-white hover:bg-black/90" size="lg" onClick={handlePublish} disabled={isPublishing}>
          {isPublishing ? (
              <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Elaborazione...</>
          ) : (
              <><Upload className="h-5 w-5 mr-2" /> Pubblica Ora</>
          )}
        </Button>
        <Button variant="outline" className="w-full h-14 text-lg font-medium" size="lg" disabled={isPublishing} onClick={() => goToStep(0)}>
          Salva Bozza
        </Button>
      </div>
    </div>
  );
}
