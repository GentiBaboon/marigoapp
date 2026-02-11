'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import type { SuggestPriceOutput } from '@/ai/flows/ai-suggest-price';

import {
  priceSuggestionSchema,
  type PriceSuggestionFormValues,
} from '@/lib/types';
import { getPriceSuggestion } from '@/app/sell/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '../ui/skeleton';

export function PriceSuggestionForm() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestPriceOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<PriceSuggestionFormValues>({
    resolver: zodResolver(priceSuggestionSchema),
    defaultValues: {
      category: '',
      brand: '',
      description: '',
    },
  });

  async function onSubmit(data: PriceSuggestionFormValues) {
    setLoading(true);
    setResult(null);
    const response = await getPriceSuggestion(data);
    if (response.success && response.data) {
      setResult(response.data);
    } else {
      toast({
        variant: 'destructive',
        title: 'An error occurred',
        description:
          response.error ||
          'There was a problem with the AI suggestion service.',
      });
    }
    setLoading(false);
  }

  return (
    <>
      <Card className="shadow-lg border-border/60">
        <CardHeader>
          <CardTitle>Item Details</CardTitle>
          <CardDescription>
            Fill out the form below to get a price suggestion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Handbags" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Chanel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the item, including its color, material, size, and any imperfections."
                        className="resize-y min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid md:grid-cols-2 gap-8">
                <FormField
                  control={form.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="like-new">Like New</SelectItem>
                          <SelectItem value="used">Used</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a currency" />
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

              <Button
                type="submit"
                disabled={loading}
                className="w-full !mt-10"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Getting
                    suggestion...
                  </>
                ) : (
                  'Suggest Price'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {loading && (
         <Card className="mt-8">
            <CardHeader>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center bg-muted p-8 rounded-lg">
                <Skeleton className="h-6 w-24 mx-auto mb-2"/>
                <Skeleton className="h-16 w-48 mx-auto"/>
              </div>
              <div>
                <Skeleton className="h-6 w-32 mb-2"/>
                <Skeleton className="h-4 w-full mb-2"/>
                <Skeleton className="h-4 w-full mb-2"/>
                <Skeleton className="h-4 w-4/5"/>
              </div>
            </CardContent>
          </Card>
      )}

      {result && (
        <Card className="mt-8 border-accent shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">
              AI Price Suggestion
            </CardTitle>
            <CardDescription>
              Based on the details you provided, here's our suggestion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
              <p className="text-muted-foreground whitespace-pre-wrap">
                {result.reasoning}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
