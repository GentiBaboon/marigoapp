'use client';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { useSellForm } from '@/components/sell/SellFormContext';
import { StepActions } from '@/components/sell/StepActions';
import { createListing } from '@/app/sell/actions';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';

export function ReviewStep() {
  const { formData, nextStep, goToStep } = useSellForm();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handlePublish = async () => {
    setIsLoading(true);
    const result = await createListing(formData);
    if (result.success) {
      toast({
        title: 'Listing Published!',
        description: 'Your item is now live on the marketplace.',
        variant: 'success',
      });
      nextStep(); // Move to success step
    } else {
      toast({
        variant: 'destructive',
        title: 'Publishing Failed',
        description: 'There was an error publishing your listing. Please try again.',
      });
    }
    setIsLoading(false);
  };

  const DetailItem = ({ label, value, step }: { label: string, value: React.ReactNode, step: number }) => (
    <div className="flex justify-between items-start">
        <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-medium">{value}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => goToStep(step)} className="h-8 w-8">
            <Pencil className="h-4 w-4 text-muted-foreground"/>
        </Button>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review & Publish</CardTitle>
        <CardDescription>
          One final look. If everything is correct, publish your listing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
            <h3 className="font-semibold">Item Preview</h3>
            <div className="grid grid-cols-3 gap-4">
                {formData.images?.slice(0,3).map((image, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                        <Image src={image.preview} alt={`preview ${index}`} fill sizes="150px" className="object-cover" />
                    </div>
                ))}
            </div>
        </div>

        <Separator />

        <div className="space-y-4">
            <DetailItem label="Title" value={formData.title} step={4} />
            <Separator />
            <DetailItem label="Category" value={`${formData.gender}, ${formData.category}`} step={1} />
             <Separator />
            <DetailItem label="Brand" value={formData.brand} step={2} />
             <Separator />
            <DetailItem label="Condition" value={formData.condition} step={2} />
             <Separator />
             <DetailItem label="Price" value={`${new Intl.NumberFormat('de-DE', { style: 'currency', currency: formData.currency || 'EUR' }).format(formData.price!)}`} step={5} />
        </div>
      </CardContent>
      <CardFooter>
        <StepActions
          onNext={handlePublish}
          nextText="Publish Listing"
          isNextLoading={isLoading}
        />
      </CardFooter>
    </Card>
  );
}
