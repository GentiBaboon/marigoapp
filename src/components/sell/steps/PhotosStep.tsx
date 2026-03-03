
'use client';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSellForm } from '../SellFormContext';
import { Button } from '@/components/ui/button';
import { Camera, X, Sparkles, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useStorage, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';

export function PhotosStep() {
  const { formData, setFormData, nextStep, activeDraft } = useSellForm();
  const { toast } = useToast();
  const storage = useStorage();
  const { user } = useUser();
  const [uploadingIndices, setUploadingIndices] = useState<Set<number>>(new Set());
  const [processingId, setProcessingId] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user || !storage || !activeDraft) {
      toast({ variant: "destructive", title: "Authentication required" });
      return;
    }

    const currentImages = formData.images || [];
    if (currentImages.length + acceptedFiles.length > 8) {
      toast({ variant: "destructive", title: "Max 8 photos allowed" });
      return;
    }

    // Prepare placeholders
    const startIndex = currentImages.length;
    const newPlaceholders = acceptedFiles.map((file, i) => ({
      url: URL.createObjectURL(file), // Local preview initially
      name: file.name,
      type: file.type,
      position: startIndex + i,
      isUploading: true
    }));

    const updatedImages = [...currentImages, ...newPlaceholders];
    setFormData({ images: updatedImages });
    
    // Set indices as uploading
    setUploadingIndices(prev => {
        const next = new Set(prev);
        newPlaceholders.forEach(p => next.add(p.position));
        return next;
    });

    // Upload each file
    acceptedFiles.forEach(async (file, index) => {
        const targetIndex = startIndex + index;
        try {
            // 1. Compress
            const options = {
                maxSizeMB: 0.8,
                maxWidthOrHeight: 1200,
                useWebWorker: true,
            };
            const compressedBlob = await imageCompression(file, options);

            // 2. Upload to draft folder
            const fileExtension = file.name.split('.').pop() || 'jpg';
            const fileName = `img_${Date.now()}_${targetIndex}.${fileExtension}`;
            const storagePath = `products/${user.uid}/${activeDraft.id}/${fileName}`;
            const storageRef = ref(storage, storagePath);
            
            const uploadTask = uploadBytesResumable(storageRef, compressedBlob, {
                contentType: file.type || 'image/jpeg'
            });

            uploadTask.on('state_changed', 
                null, 
                (error) => {
                    console.error("Upload error", error);
                    toast({ variant: "destructive", title: "Upload failed" });
                    setUploadingIndices(prev => {
                        const next = new Set(prev);
                        next.delete(targetIndex);
                        return next;
                    });
                }, 
                async () => {
                    const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                    
                    // Update the image in the form data with the real URL
                    setFormData({
                        images: (formData.images || []).map(img => 
                            img.position === targetIndex 
                            ? { ...img, url: downloadUrl, isUploading: false } 
                            : img
                        )
                    });

                    setUploadingIndices(prev => {
                        const next = new Set(prev);
                        next.delete(targetIndex);
                        return next;
                    });
                }
            );
        } catch (error) {
            console.error("Compression/Upload loop error", error);
        }
    });

  }, [formData.images, setFormData, toast, user, storage, activeDraft]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 8
  });

  const removePhoto = (index: number) => {
    const newImages = [...(formData.images || [])];
    newImages.splice(index, 1);
    const indexedImages = newImages.map((img, i) => ({ ...img, position: i }));
    setFormData({ images: indexedImages });
  };

  const removeBackground = async (index: number) => {
    setProcessingId(`img-${index}`);
    await new Promise(r => setTimeout(r, 2000));
    toast({ title: "Background removed ✨ (Demo)" });
    setProcessingId(null);
  };

  const isAnythingUploading = uploadingIndices.size > 0;
  const canContinue = (formData.images?.length || 0) >= 3 && !isAnythingUploading;

  return (
    <div className="space-y-6">
      <div className="bg-muted/30 p-4 rounded-lg border border-dashed text-center">
        <h3 className="font-semibold text-lg">Tips for great photos</h3>
        <ul className="text-sm text-muted-foreground mt-2 space-y-1">
          <li>• Minimum 3 photos, maximum 8</li>
          <li>• Use natural daylight</li>
          <li>• Show any defects clearly</li>
        </ul>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "aspect-video border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        )}
      >
        <input {...getInputProps()} />
        <Camera className="h-10 w-10 text-muted-foreground mb-2" />
        <p className="font-medium">Drag & drop or click to upload</p>
        <p className="text-xs text-muted-foreground mt-1">JPG, PNG or WEBP (Max 10MB)</p>
      </div>

      {formData.images && formData.images.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {formData.images.map((img, index) => (
            <div key={index} className="relative aspect-square rounded-lg overflow-hidden border bg-muted group">
              <Image 
                src={img.url} 
                alt="Preview" 
                fill 
                className={cn("object-cover", img.isUploading && "opacity-50 grayscale")}
                unoptimized={img.url.startsWith('blob:')}
              />
              
              {img.isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
              )}

              {!img.isUploading && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button 
                        type="button"
                        className="bg-destructive text-destructive-foreground p-1.5 rounded-full hover:scale-110 transition-transform" 
                        onClick={() => removePhoto(index)}
                    >
                        <X className="h-4 w-4" />
                    </button>
                    <button 
                        type="button"
                        className="bg-secondary text-secondary-foreground p-1.5 rounded-full hover:scale-110 transition-transform" 
                        onClick={() => removeBackground(index)} 
                        disabled={!!processingId}
                    >
                        {processingId === `img-${index}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    </button>
                </div>
              )}
              
              {index === 0 && (
                <div className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold py-0.5 text-center uppercase">Main Photo</div>
              )}
            </div>
          ))}
        </div>
      )}

      <Button className="w-full h-14 text-lg" size="lg" disabled={!canContinue} onClick={nextStep}>
        {isAnythingUploading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Uploading...</>
        ) : 'Continue'}
      </Button>
    </div>
  );
}
