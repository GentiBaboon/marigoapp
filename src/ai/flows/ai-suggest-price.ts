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

const SuggestPriceInputSchema = z.object({
  category: z.string().describe('The category of the product.'),
  brand: z.string().describe('The brand of the product.'),
  condition: z.string().describe('The condition of the product (e.g., new, used, like new).'),
  description: z.string().describe('A detailed description of the product.'),
  currency: z.string().describe('The currency in which the price should be suggested (e.g., EUR, ALL).'),
});
export type SuggestPriceInput = z.infer<typeof SuggestPriceInputSchema>;

const SuggestPriceOutputSchema = z.object({
  suggestedPrice: z.number().describe('The suggested price for the product.'),
  reasoning: z.string().describe('The reasoning behind the suggested price.'),
});
export type SuggestPriceOutput = z.infer<typeof SuggestPriceOutputSchema>;

export async function suggestPrice(input: SuggestPriceInput): Promise<SuggestPriceOutput> {
  return suggestPriceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestPricePrompt',
  input: {schema: SuggestPriceInputSchema},
  output: {schema: SuggestPriceOutputSchema},
  prompt: `You are an expert in pricing luxury fashion items. Based on the
following details, suggest a competitive price for the product in
the specified currency. Explain your reasoning.

Category: {{{category}}}
Brand: {{{brand}}}
Condition: {{{condition}}}
Description: {{{description}}}
Currency: {{{currency}}}

Please provide the suggested price and your reasoning. Your response must be formatted as a valid JSON object matching the SuggestPriceOutputSchema schema.
`,
});

const suggestPriceFlow = ai.defineFlow(
  {
    name: 'suggestPriceFlow',
    inputSchema: SuggestPriceInputSchema,
    outputSchema: SuggestPriceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
