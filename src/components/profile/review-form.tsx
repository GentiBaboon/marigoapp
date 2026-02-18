'use client';
import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { FirestoreOrder } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useI18n } from '@/hooks/use-i18n';
import { translateText } from '@/ai/flows/translate-text';

const reviewSchema = z.object({
  rating: z.number().min(1, 'Please select a rating.'),
  content: z.string().min(10, 'Review must be at least 10 characters.'),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

function StarRating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [hoverValue, setHoverValue] = React.useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHoverValue(star)}
          onMouseLeave={() => setHoverValue(0)}
          onClick={() => onChange(star)}
          className="p-1"
        >
          <Star
            className={cn(
              'h-8 w-8 transition-colors',
              (hoverValue || value) >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
            )}
          />
        </button>
      ))}
    </div>
  );
}

interface ReviewFormProps {
    order: FirestoreOrder;
}

export function ReviewForm({ order }: ReviewFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { locale } = useI18n();
  
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, content: '' },
  });
  
  const onSubmit = async (data: ReviewFormValues) => {
    if (!user || !firestore || order.sellerIds.length === 0) return;
    setIsSubmitting(true);

    try {
        const translatedContent = await translateText({ text: data.content, sourceLanguage: locale });

        const reviewData = {
            orderId: order.id,
            productId: order.items[0].productId, // Assuming review is for the first item for now
            reviewerId: user.uid,
            revieweeId: order.sellerIds[0], // Assuming single seller for now
            rating: data.rating,
            content: translatedContent,
            createdAt: serverTimestamp(),
        };

        await addDoc(collection(firestore, 'reviews'), reviewData);
        toast({
            title: 'Review Submitted!',
            description: 'Thank you for your feedback.',
            variant: 'success',
        });
        // Here you might want to update the order to mark it as reviewed
    } catch (error) {
        console.error("Error submitting review:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'reviews',
            operation: 'create',
            requestResourceData: { error: 'data too large to display' },
        }));
        toast({
            variant: 'destructive',
            title: 'Uh oh! Something went wrong.',
            description: 'Could not submit your review. Please try again.',
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="rating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Rating</FormLabel>
              <FormControl>
                <StarRating value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Review</FormLabel>
              <FormControl>
                <Textarea placeholder="Tell us about your experience..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Review
        </Button>
      </form>
    </Form>
  );
}
