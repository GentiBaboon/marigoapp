'use server';

/**
 * @fileOverview This file implements the AI price suggestion flow for sellers.
 *
 * - suggestPrice - An async function that suggests a price for a product based on its details.
 * - SuggestPriceInput - The input type for the suggestPrice function.
 * - SuggestPriceOutput - The return type for the suggestPrice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { similarSoldItems } from '@/lib/mock-data';

const SuggestPriceInputSchema = z.object({
  category: z.string().describe('The category of the product.'),
  brand: z.string().describe('The brand of the product.'),
  condition: z.string().describe('The condition of the product (e.g., new, used, like new).'),
  description: z.string().describe('A detailed description of the product.'),
  currency: z.string().describe('The currency in which the price should be suggested (e.g., EUR, ALL).'),
});
export type SuggestPriceInput = z.infer<typeof SuggestPriceInputSchema>;

const SimilarSoldItemSchema = z.object({
    id: z.string(),
    brand: z.string(),
    title: z.string(),
    price: z.number(),
    image: z.string(),
    soldDate: z.string(),
});

const SuggestPriceOutputSchema = z.object({
  suggestedPrice: z.number().describe('The suggested price for the product.'),
  reasoning: z.string().describe('The reasoning behind the suggested price.'),
  similarSoldItems: z.array(SimilarSoldItemSchema).describe('A list of 3 similar items that have been sold recently.'),
});
export type SuggestPriceOutput = z.infer<typeof SuggestPriceOutputSchema>;

export async function suggestPrice(input: SuggestPriceInput): Promise<SuggestPriceOutput> {
  return suggestPriceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestPricePrompt',
  input: {schema: SuggestPriceInputSchema},
  output: {schema: SuggestPriceOutputSchema},
  prompt: `You are an expert in pricing luxury fashion items for a C2C marketplace like Vestiaire Collective.
Your goal is to suggest a competitive but fair market price to help the seller sell their item quickly.
Also, provide a list of 3 similar items that were sold in the past to give the user context.

Based on the following details, suggest a price and provide your reasoning.

- Category: {{{category}}}
- Brand: {{{brand}}}
- Condition: {{{condition}}}
- Description: {{{description}}}
- Currency for suggestion: {{{currency}}}

Consider the brand's value, the item's condition, its desirability, the category, and recent market trends.

Your response must be a valid JSON object matching the SuggestPriceOutputSchema schema.
For the 'similarSoldItems' array, you MUST provide exactly 3 items. You can use the provided example items if they are relevant, or create realistic new ones if not.
Example Similar Items:
${JSON.stringify(similarSoldItems, null, 2)}
`,
});

const suggestPriceFlow = ai.defineFlow(
  {
    name: 'suggestPriceFlow',
    inputSchema: SuggestPriceInputSchema,
    outputSchema: SuggestPriceOutputSchema,
  },
  async input => {
    // In a real application, this is where you might fetch real historical data
    // to pass into the prompt. For now, we rely on the examples in the prompt itself.
    const {output} = await prompt(input);
    return output!;
  }
);
