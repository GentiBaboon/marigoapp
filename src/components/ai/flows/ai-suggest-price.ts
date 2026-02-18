'use server';
/**
 * @fileOverview A flow for suggesting a product price using AI.
 *
 * - suggestPrice - A function that calls the AI model to generate a price suggestion.
 * - SuggestPriceInput - The input type for the suggestPrice function.
 * - SuggestPriceOutput - The return type for the suggestPrice function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const SuggestPriceInputSchema = z.object({
  title: z.any().describe('The title of the product.'),
  brand: z.string().describe('The brand of the product.'),
  category: z.string().describe('The category of the product.'),
  condition: z.string().optional().describe('The condition of the product (e.g., New, Like New, Good).'),
  images: z.array(z.string().url()).describe("A list of product photos as public URLs."),
});
export type SuggestPriceInput = z.infer<typeof SuggestPriceInputSchema>;

export const SuggestPriceOutputSchema = z.object({
    minPrice: z.number().describe('The minimum suggested selling price in EUR.'),
    maxPrice: z.number().describe('The maximum suggested selling price in EUR.'),
    recommendedPrice: z.number().describe('The single recommended selling price in EUR, which should fall between the min and max prices.'),
    reasoning: z.string().describe('A brief explanation for the price suggestion, mentioning factors like brand, condition, and item type.'),
});
export type SuggestPriceOutput = z.infer<typeof SuggestPriceOutputSchema>;

export async function suggestPrice(input: SuggestPriceInput): Promise<SuggestPriceOutput> {
  return suggestPriceFlow(input);
}

const priceSuggestionPrompt = ai.definePrompt({
  name: 'priceSuggestor',
  input: { schema: SuggestPriceInputSchema },
  output: { schema: SuggestPriceOutputSchema },
  prompt: `You are an expert appraiser for a high-end C2C fashion marketplace called MarigoApp. Your task is to suggest a realistic selling price in EUR for a pre-owned luxury item based on the details and photos provided.

    Analyze the provided brand, category, condition, and images to determine its market value.

    Provide a minimum price, a maximum price, and a single recommended price within that range.
    Also, provide a brief reasoning for your recommendation (1-2 sentences), mentioning factors you considered.
    Do not mention that you are an AI. Base your pricing on the assumption that the item is authentic.

    Product Details:
    - Title: {{title}}
    - Brand: {{brand}}
    - Category: {{category}}
    {{#if condition}}- Condition: {{condition}}{{/if}}

    Images:
    {{#each images}}
    {{media url=this}}
    {{/each}}
    `,
});

const suggestPriceFlow = ai.defineFlow(
  {
    name: 'suggestPriceFlow',
    inputSchema: SuggestPriceInputSchema,
    outputSchema: SuggestPriceOutputSchema,
  },
  async (input) => {
    const { output } = await priceSuggestionPrompt(input);
    return output!;
  }
);

    