import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { z } from 'zod';

const RecommendationInputSchema = z.object({
  wishlistedBrands: z.array(z.string()),
  wishlistedCategories: z.array(z.string()),
  viewedBrands: z.array(z.string()).optional(),
  viewedCategories: z.array(z.string()).optional(),
});

const RecommendationOutputSchema = z.object({
  query: z.object({
    brands: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
  }),
  reasoning: z.string(),
});

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RecommendationInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { output } = await recommendationPrompt(parsed.data);
    return NextResponse.json(output!);
  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 });
  }
}
