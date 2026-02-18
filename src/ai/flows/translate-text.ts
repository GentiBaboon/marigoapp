'use server';
/**
 * @fileOverview A flow for translating text into multiple languages.
 *
 * - translateText - A function that calls the AI model to generate translations.
 * - TranslateInput - The input type for the translateText function.
 * - TranslateOutput - The return type for the translateText function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const TranslateInputSchema = z.object({
  text: z.string().describe('The text to be translated.'),
  sourceLanguage: z
    .string()
    .describe('The source language of the text (e.g., "en", "it", "sq").'),
});
export type TranslateInput = z.infer<typeof TranslateInputSchema>;

export const TranslateOutputSchema = z.object({
  sq: z.string().describe('The Albanian translation.'),
  en: z.string().describe('The English translation.'),
  it: z.string().describe('The Italian translation.'),
});
export type TranslateOutput = z.infer<typeof TranslateOutputSchema>;

export async function translateText(
  input: TranslateInput
): Promise<TranslateOutput> {
  return translateTextFlow(input);
}

const translationPrompt = ai.definePrompt({
  name: 'translator',
  input: { schema: TranslateInputSchema },
  output: { schema: TranslateOutputSchema },
  prompt: `You are an expert translator. Your task is to translate the given text from the source language into Albanian, English, and Italian.
    
    If the input text is very short or a single word (like a brand name), return the original text for all languages.
    
    Return the result as a valid JSON object with keys "sq", "en", and "it".
    
    Source Language: {{sourceLanguage}}
    Text to translate: "{{text}}"
    `,
});

const translateTextFlow = ai.defineFlow(
  {
    name: 'translateTextFlow',
    inputSchema: TranslateInputSchema,
    outputSchema: TranslateOutputSchema,
  },
  async (input) => {
    // Handle short/untranslatable text to save API calls
    if (input.text.trim().length < 3) {
      return {
        sq: input.text,
        en: input.text,
        it: input.text,
      };
    }
    const { output } = await translationPrompt(input);
    return output!;
  }
);
