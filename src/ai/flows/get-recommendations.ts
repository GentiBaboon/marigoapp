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

// Fetch helper in `src/ai/recommendations-client.ts` (zod-free); see there.
export { getRecommendations } from '../recommendations-client';
