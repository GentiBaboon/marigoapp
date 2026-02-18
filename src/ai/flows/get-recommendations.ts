'use server';
/**
 * @fileOverview A flow for generating personalized product recommendations.
 *
 * - getRecommendations - A function that calls the AI model to generate a search query.
 * - RecommendationInput - The input type for the getRecommendations function.
 * - RecommendationOutput - The return type for the getRecommendations function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const RecommendationInputSchema = z.object({
  wishlistedBrands: z.array(z.string()).describe("A list of brands the user has added to their wishlist."),
  wishlistedCategories: z.array(z.string()).describe("A list of product categories the user has added to their wishlist."),
  viewedBrands: z.array(z.string()).optional().describe("A list of brands the user has recently viewed."),
  viewedCategories: z.array(z.string()).optional().describe("A list of product categories the user has recently viewed."),
});
export type RecommendationInput = z.infer<typeof RecommendationInputSchema>;

export const RecommendationOutputSchema = z.object({
  query: z.object({
    brands: z.array(z.string()).optional().describe("A list of suggested brands to query."),
    categories: z.array(z.string()).optional().describe("A list of suggested categories to query."),
  }),
  reasoning: z.string().describe("A short, friendly title for the recommendation set, like 'Because you love Chanel' or 'More handbags to discover'."),
});
export type RecommendationOutput = z.infer<typeof RecommendationOutputSchema>;

export async function getRecommendations(input: RecommendationInput): Promise<RecommendationOutput> {
  return getRecommendationsFlow(input);
}

const recommendationPrompt = ai.definePrompt({
  name: 'recommendationGenerator',
  input: { schema: RecommendationInputSchema },
  output: { schema: RecommendationOutputSchema },
  prompt: `You are a personal stylist for MarigoApp, a luxury fashion marketplace.
    Your task is to generate a product search query based on a user's preferences.
    Analyze the user's wishlisted and viewed items to identify their favorite brands and categories.
    
    - Prioritize brands and categories that appear most frequently in the user's wishlist.
    - If the user has a clear preference for a brand, suggest querying for that brand, maybe in a category they also like.
    - If the user has a clear preference for a category but not a specific brand, suggest that category.
    - Create a short, engaging title for the recommendation set. For example, if you're recommending 'Chanel' items, the reasoning could be 'Because you love Chanel'. If you're recommending handbags, it could be 'More Handbags for You'.

    User Preferences:
    - Wishlisted Brands: {{wishlistedBrands}}
    - Wishlisted Categories: {{wishlistedCategories}}
    {{#if viewedBrands}}- Recently Viewed Brands: {{viewedBrands}}{{/if}}
    {{#if viewedCategories}}- Recently Viewed Categories: {{viewedCategories}}{{/if}}

    Generate a JSON object containing the query and a reasoning string. The query should contain arrays of brands and/or categories to search for.
    `,
});

const getRecommendationsFlow = ai.defineFlow(
  {
    name: 'getRecommendationsFlow',
    inputSchema: RecommendationInputSchema,
    outputSchema: RecommendationOutputSchema,
  },
  async (input) => {
    const { output } = await recommendationPrompt(input);
    return output!;
  }
);
