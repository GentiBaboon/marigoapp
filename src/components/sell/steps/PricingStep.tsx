'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useSellForm } from '@/components/sell/SellFormContext';
import { sellStep5Schema } from '@/lib/types';
import type { z } from 'zod';
import { StepActions } from '@/components/sell/StepActions';
import { getPriceSuggestion } from '@/app/sell/actions';
import type { SuggestPriceOutput } from '@/ai/flows/ai-suggest-price';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Step5Values = z.infer<typeof sellStep5Schema>;

export function PricingStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestPriceOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<Step5Values>({
    resolver: zodResolver(sellStep5Schema),
    defaultValues: {
      price: formData.price,
      currency: formData.currency || 'EUR',
    },
  });

  const onSubmit = (data: Step5Values) => {
    setFormData(data);
    nextStep();
  };

  const handleGetSuggestion = async () => {
    setLoading(true);
    setResult(null);

    const dataForAI = {
      category: formData.category!,
      brand: formData.brand!,
      condition: formData.condition!,
      description: formData.description!,
      currency: form.getValues('currency'),
    }

    const response = await getPriceSuggestion(dataForAI);
    if (response.success && response.data) {
      setResult(response.data);
      form.setValue('price', response.data.suggestedPrice, { shouldValidate: true });
    } else {
      toast({
        variant: 'destructive',
        title: 'An error occurred',
        description: response.error || 'There was a problem with the AI suggestion service.',
      });
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Your Price</CardTitle>
        <CardDescription>
          Enter your asking price. Not sure? Use our AI suggestion tool.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-muted/50 p-4 rounded-lg mb-8 space-y-2">
            <Button onClick={handleGetSuggestion} disabled={loading} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                Get AI Price Suggestion
            </Button>
        </div>

        {loading && (
             <div className="space-y-4 mb-8">
              <div className="text-center bg-muted p-8 rounded-lg">
                <Skeleton className="h-6 w-24 mx-auto mb-2"/>
                <Skeleton className="h-16 w-48 mx-auto"/>
              </div>
              <div>
                <Skeleton className="h-6 w-32 mb-2"/>
                <Skeleton className="h-4 w-full mb-2"/>
                <Skeleton className="h-4 w-4/5"/>
              </div>
            </div>
        )}

        {result && (
            <div className="mb-8 space-y-6 animate-in fade-in-50">
                <div className="text-center bg-muted p-8 rounded-lg border">
                <p className="text-sm text-muted-foreground uppercase tracking-widest">
                    Suggested Price
                </p>
                <p className="font-headline text-6xl font-bold text-primary">
                    {new Intl.NumberFormat('de-DE', {
                    style: 'currency',
                    currency: form.getValues('currency'),
                    }).format(result.suggestedPrice)}
                </p>
                </div>
                <div>
                <h4 className="font-semibold text-lg mb-2 font-headline">Reasoning</h4>
                <p className="text-muted-foreground whitespace-pre-wrap text-sm">
                    {result.reasoning}
                </p>
                </div>
            </div>
        )}


        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                    <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Your Price</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g. 550" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                <div>
                    <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Currency" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="ALL">ALL (L)</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
            </div>
            
            <StepActions onNext={form.handleSubmit(onSubmit)} />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
