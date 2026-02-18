'use server';
/**
 * @fileOverview An AI flow for enhancing search queries.
 *
 * - smartSearch - A function that takes a user's search query and returns corrected and expanded search terms.
 * - SmartSearchInput - The input type for the smartSearch function.
 * - SmartSearchOutput - The return type for the smartSearch function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const SmartSearchInputSchema = z.object({
  query: z.string().describe('The user\'s search query.'),
  history: z.array(z.string()).optional().describe('The user\'s recent search history.'),
});
export type SmartSearchInput = z.infer<typeof SmartSearchInputSchema>;

export const SmartSearchOutputSchema = z.object({
    correctedQuery: z.string().describe('The search query with any misspellings corrected. If no correction is needed, return the original query.'),
    expandedTerms: z.array(z.string()).describe('A list of expanded terms from abbreviations found in the query (e.g., "LV" becomes "Louis Vuitton"). If no abbreviations, return an empty array.'),
    relatedSearches: z.array(z.string()).describe('A list of 2-3 related search suggestions that a user might also be interested in.'),
});
export type SmartSearchOutput = z.infer<typeof SmartSearchOutputSchema>;

export async function smartSearch(input: SmartSearchInput): Promise<SmartSearchOutput> {
  return smartSearchFlow(input);
}

const smartSearchPrompt = ai.definePrompt({
  name: 'smartSearchPrompt',
  input: { schema: SmartSearchInputSchema },
  output: { schema: SmartSearchOutputSchema },
  prompt: `You are a smart search assistant for a luxury fashion marketplace called MarigoApp. Your task is to enhance a user's search query.

    Given the user's query and their recent search history, perform the following actions:
    1.  **Correct Misspellings:** Identify and correct any spelling mistakes in the query.
    2.  **Expand Abbreviations:** Expand common luxury brand abbreviations (e.g., "LV" to "Louis Vuitton", "YSL" to "Saint Laurent").
    3.  **Suggest Related Searches:** Based on the corrected and expanded query, provide a few related search terms. Think about materials, styles, or alternative items.

    User's Query: "{{query}}"
    {{#if history}}
    User's Recent Searches:
    {{#each history}}
    - {{this}}
    {{/each}}
    {{/if}}

    Return the result in the specified JSON format.
    `,
});

const smartSearchFlow = ai.defineFlow(
  {
    name: 'smartSearchFlow',
    inputSchema: SmartSearchInputSchema,
    outputSchema: SmartSearchOutputSchema,
  },
  async (input) => {
    const { output } = await smartSearchPrompt(input);
    return output!;
  }
);
