/**
 * @fileOverview Client helper for AI product recommendations.
 * Server logic lives in /api/ai/recommendations/route.ts.
 */
import { z } from 'zod';

export const RecommendationInputSchema = z.object({
  wishlistedBrands: z.array(z.string()),
  wishlistedCategories: z.array(z.string()),
  viewedBrands: z.array(z.string()).optional(),
  viewedCategories: z.array(z.string()).optional(),
});

export type RecommendationInput = z.infer<typeof RecommendationInputSchema>;

export const RecommendationOutputSchema = z.object({
  query: z.object({
    brands: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
  }),
  reasoning: z.string(),
});

export type RecommendationOutput = z.infer<typeof RecommendationOutputSchema>;

export async function getRecommendations(input: RecommendationInput): Promise<RecommendationOutput> {
  const res = await fetch('/api/ai/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to get recommendations');
  }

  return res.json();
}
