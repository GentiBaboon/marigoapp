'use client';
import { useSellForm } from '../SellFormContext';
import { Button } from '@/components/ui/button';
import { Check, Edit2, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export function ReviewStep() {
  const { formData, goToStep } = useSellForm();
  const [isPublishing, setIsPublishing] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();

  const handlePublish = async () => {
    if (!user) return;
    setIsPublishing(true);
    try {
      const productId = `prod_${Date.now()}`;
      await setDoc(doc(firestore, 'products', productId), {
        ...formData,
        sellerId: user.uid,
        status: 'active',
        listingCreated: serverTimestamp(),
        images: formData.images?.map(img => img.url) || [],
      });
      toast({ title: "Listing Published!", variant: "success" });
      router.push(`/products/${productId}`);
    } catch (e) {
      toast({ variant: "destructive", title: "Error publishing listing" });
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

      <div className="relative aspect-[3/4] rounded-xl overflow-hidden border">
        {formData.images?.[0] && <Image src={formData.images[0].url} alt="Main" fill className="object-cover" />}
        <Button variant="secondary" size="sm" className="absolute bottom-4 right-4" onClick={() => goToStep(1)}>
          <Edit2 className="h-4 w-4 mr-2" /> Edit Photos
        </Button>
      </div>

      <div className="space-y-6">
        <section className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">{formData.brand}</h3>
            <span className="text-xl font-bold">€{formData.price}</span>
          </div>
          <p className="text-muted-foreground">{formData.title}</p>
          <div className="flex gap-2">
            <span className="bg-muted px-2 py-1 rounded text-xs uppercase font-semibold">{formData.size}</span>
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
          {isPublishing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
          Publish Now
        </Button>
        <Button variant="outline" className="w-full h-14" size="lg" onClick={() => router.push('/profile/listings')}>
          Save as Draft
        </Button>
      </div>
    </div>
  );
}
