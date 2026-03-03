
'use client';
import { useCallback, useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSellForm } from '../SellFormContext';
import { Button } from '@/components/ui/button';
import { Camera, X, Sparkles, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useStorage, useUser } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';

export function PhotosStep() {
  const { formData, setFormData, nextStep, activeDraft } = useSellForm();
  const { toast } = useToast();
  const storage = useStorage();
  const { user } = useUser();
  
  const [localImages, setLocalImages] = useState(formData.images || []);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Sync with global context whenever local changes
  useEffect(() => {
    setFormData({ images: localImages });
  }, [localImages, setFormData]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user || !storage || !activeDraft) {
      toast({ variant: "destructive", title: "Autenticazione richiesta" });
      return;
    }

    const currentCount = localImages.length;
    if (currentCount + acceptedFiles.length > 8) {
      toast({ variant: "destructive", title: "Massimo 8 foto consentite" });
      return;
    }

    // Add files to local state with immediate previews
    const newItems = acceptedFiles.map((file, i) => ({
      url: URL.createObjectURL(file),
      name: file.name,
      type: file.type,
      position: currentCount + i,
      isUploading: true,
      file // Keep original file for upload
    }));

    setLocalImages(prev => [...prev, ...newItems]);
    setUploadingCount(prev => prev + newItems.length);

    // Process each file
    for (const item of newItems) {
      const { file, position, name } = item;
      
      try {
        // 1. Compression
        const options = {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        };
        const compressedBlob = await imageCompression(file as File, options);

        // 2. Storage Setup
        const fileExt = name.split('.').pop() || 'jpg';
        const fileName = `img_${Date.now()}_${position}.${fileExt}`;
        const storagePath = `products/${user.uid}/${activeDraft.id}/${fileName}`;
        const storageRef = ref(storage, storagePath);
        
        // 3. Upload Task
        const uploadTask = uploadBytesResumable(storageRef, compressedBlob, {
          contentType: file.type || 'image/jpeg'
        });

        uploadTask.on('state_changed', 
          null, 
          (error) => {
            console.error("Upload error:", error);
            toast({ variant: "destructive", title: `Errore caricamento: ${name}` });
            setLocalImages(prev => prev.filter(img => img.position !== position));
            setUploadingCount(prev => Math.max(0, prev - 1));
          }, 
          async () => {
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              
              setLocalImages(prev => prev.map(img => 
                img.position === position 
                ? { ...img, url: downloadUrl, isUploading: false } 
                : img
              ));
            } catch (urlError) {
              console.error("URL retrieval error:", urlError);
              setLocalImages(prev => prev.filter(img => img.position !== position));
            } finally {
              setUploadingCount(prev => Math.max(0, prev - 1));
            }
          }
        );
      } catch (err) {
        console.error("Pre-upload error:", err);
        setLocalImages(prev => prev.filter(img => img.position !== position));
        setUploadingCount(prev => Math.max(0, prev - 1));
      }
    }
  }, [localImages.length, user, storage, activeDraft, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 8 - localImages.length,
    disabled: uploadingCount > 0
  });

  const removePhoto = (index: number) => {
    setLocalImages(prev => {
      const next = [...prev];
      next.splice(index, 1);
      return next.map((img, i) => ({ ...img, position: i }));
    });
  };

  const isAnythingUploading = uploadingCount > 0;
  const canContinue = localImages.length >= 3 && !isAnythingUploading;

  return (
    <div className="space-y-6">
      <div className="bg-muted/30 p-4 rounded-lg border border-dashed text-center">
        <h3 className="font-semibold text-lg">Consigli per le foto</h3>
        <ul className="text-sm text-muted-foreground mt-2 space-y-1">
          <li>• Minimo 3 foto, massimo 8</li>
          <li>• Usa luce naturale</li>
          <li>• Mostra chiaramente eventuali difetti</li>
        </ul>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "aspect-video border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
          isAnythingUploading && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <Camera className="h-10 w-10 text-muted-foreground mb-2" />
        <p className="font-medium">Trascina o clicca per caricare</p>
        <p className="text-xs text-muted-foreground mt-1">JPG, PNG o WEBP (Max 10MB)</p>
      </div>

      {localImages.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {localImages.map((img, index) => (
            <div key={index} className="relative aspect-square rounded-lg overflow-hidden border bg-muted group">
              <Image 
                src={img.url} 
                alt="Preview" 
                fill 
                className={cn("object-cover", img.isUploading && "opacity-50 grayscale")}
                unoptimized={img.url.startsWith('blob:')}
              />
              
              {img.isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}

              {!img.isUploading && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    type="button"
                    className="bg-destructive text-white p-2 rounded-full hover:scale-110 transition-transform" 
                    onClick={() => removePhoto(index)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
              
              {index === 0 && (
                <div className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold py-0.5 text-center uppercase">Foto Principale</div>
              )}
            </div>
          ))}
        </div>
      )}

      <Button 
        className="w-full h-14 text-lg font-bold" 
        size="lg" 
        disabled={!canContinue} 
        onClick={nextStep}
      >
        {isAnythingUploading ? (
          <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</>
        ) : 'Continua'}
      </Button>
    </div>
  );
}
