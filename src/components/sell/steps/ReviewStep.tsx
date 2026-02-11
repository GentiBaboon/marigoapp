'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSellForm } from '@/components/sell/SellFormContext';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Pencil, Info, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { categories, productConditions } from '@/lib/mock-data';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

// Helper component for each review section
const ReviewSection = ({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode; }) => (
    <div>
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            <Button variant="ghost" onClick={onEdit} className="flex items-center gap-1.5 text-sm text-muted-foreground h-auto p-0 hover:bg-transparent hover:text-primary">
                <Pencil className="h-3 w-3" />
                Edit
            </Button>
        </div>
        <div className="space-y-1 text-sm">{children}</div>
    </div>
);

// Helper for detail rows
const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between items-center">
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-medium text-right">{value}</span>
    </div>
);


export function ReviewStep() {
  const { formData, nextStep, goToStep, unselectDraft } = useSellForm();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();

  const handlePublish = async () => {
    if (!user || !firestore) {
        toast({
            variant: 'destructive',
            title: 'Authentication Error',
            description: 'You must be signed in to create a listing.',
        });
        return;
    }
    setIsLoading(true);

    const listingData = {
      sellerId: user.uid,
      title: formData.title || '',
      description: formData.description || '',
      brandId: formData.brand || '',
      categoryId: formData.category || '',
      subcategoryId: formData.category || '',
      condition: formData.condition || 'good',
      listingType: 'fixed_price',
      price: formData.price || 0,
      originalPrice: null,
      currency: formData.currency || 'EUR',
      size: formData.sizeValue || null,
      color: formData.color || null,
      material: formData.material || null,
      gender: formData.gender ? (formData.gender.replace('wear', '') as any) : null,
      images: formData.images?.map((img, i) => ({ url: img.preview, position: i })) || [],
      status: 'active',
      views: 0,
      wishlistCount: 0,
      isFeatured: false,
      isAuthenticated: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    addDoc(collection(firestore, "products"), listingData)
        .then(docRef => {
            nextStep();
        })
        .catch(error => {
            const permissionError = new FirestorePermissionError({
                path: 'products',
                operation: 'create',
                requestResourceData: listingData,
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: 'destructive',
                title: 'Publishing Failed',
                description: 'There was a problem publishing your listing. Please try again.',
            });
        })
        .finally(() => {
            setIsLoading(false);
        });
  };

  const handleSaveDraft = () => {
    unselectDraft();
    router.push('/sell');
  };
  
  const getCategoryName = (slug: string | undefined) => {
    if (!slug) return 'N/A';
    // The image shows "Handbags", which isn't a direct category, so we'll do our best.
    const cat = categories.find(c => c.slug === slug);
    if(cat?.slug === 'bags') return 'Handbags';
    return cat?.name || slug;
  }
  
  const getConditionLabel = (value: string | undefined) => {
    if (!value) return 'N/A';
    const condition = productConditions.find(c => c.value === value);
    // The image shows "Good condition"
    return condition ? `${condition.label} condition` : value;
  }
  
  const currencyFormatter = (value: number) => {
    // The image shows 37$
    return `${value}$`;
  }
  
  return (
    <div className="space-y-8">
        <div>
            <h2 className="text-2xl font-bold">Review before listing</h2>
        </div>

        <Alert variant="default" className="bg-amber-50 border-amber-200">
            <Info className="h-4 w-4 text-amber-600"/>
            <AlertDescription className="text-amber-900">
                Double check everything: after listing, you can only add photos and lower the price.
            </AlertDescription>
        </Alert>
        
        <div className="space-y-6">
            <ReviewSection title="Details" onEdit={() => goToStep(2)}>
                 <DetailRow label="Category" value={getCategoryName(formData.category)} />
                 <DetailRow label="Condition" value={getConditionLabel(formData.condition)} />
                 <DetailRow label="Material" value={formData.material || 'N/A'} />
                 <DetailRow label="Color" value={formData.color || 'N/A'} />
                 <DetailRow label="Pattern" value={formData.pattern || 'Plain'} />
            </ReviewSection>

            <Separator/>

            <ReviewSection title="Photos" onEdit={() => goToStep(3)}>
                <p className="text-muted-foreground text-xs">Main photo</p>
                <div className="grid grid-cols-3 gap-2 mt-2">
                    {formData.images?.slice(0, 3).map((image, index) => (
                        <div key={index} className="relative aspect-[1/1] rounded-md overflow-hidden bg-muted">
                            <Image src={image.preview} alt={`preview ${index}`} fill sizes="150px" className="object-cover" />
                        </div>
                    ))}
                </div>
            </ReviewSection>

            <Separator/>
            
             <ReviewSection title="Description" onEdit={() => goToStep(4)}>
                <p className="text-foreground">{formData.description}</p>
            </ReviewSection>

            <Separator/>

            <ReviewSection title="Price" onEdit={() => goToStep(5)}>
                <p className="font-semibold text-lg">{currencyFormatter(formData.price || 0)} (you earn {currencyFormatter(formData.sellerEarning || 0)})</p>
                <p className="text-sm text-muted-foreground flex items-center">
                    Buyer service fee not included
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 cursor-default">
                                    <Info className="h-3 w-3" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>The buyer will pay an additional service fee on top of your listing price.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </p>
            </ReviewSection>

            <Separator/>

            {/* In a real app, this would come from the user's profile */}
            <ReviewSection title="Address" onEdit={() => alert('Address editing is not implemented in this step.')}>
                 <p className="font-medium">Genti Dhimitri</p>
                 <p className="text-muted-foreground">Via Malvolta, 19, 40137 Bologna</p>
            </ReviewSection>
        </div>
        
        <div className="space-y-4 pt-4">
             <p className="text-xs text-center text-muted-foreground">
                By clicking on "Submit my item", I confirm that the information provided complies with the <Link href="#" className="underline">general terms of use</Link>.
             </p>
            <div className="flex items-center justify-between">
                <Button variant="link" className="text-foreground font-semibold px-0" onClick={handleSaveDraft}>Save draft</Button>
                <Button size="lg" className="bg-foreground text-background hover:bg-foreground/90" onClick={handlePublish} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit my item
                </Button>
            </div>
        </div>
    </div>
  );
}
