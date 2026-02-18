'use server';
/**
 * @fileOverview A flow for generating product descriptions using AI.
 *
 * - generateDescription - A function that calls the AI model to generate a description.
 * - GenerateDescriptionInput - The input type for the generateDescription function.
 * - GenerateDescriptionOutput - The return type for the generateDescription function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const GenerateDescriptionInputSchema = z.object({
  title: z.string().describe('The title of the product.'),
  brand: z.string().describe('The brand of the product.'),
  category: z.string().describe('The category of the product.'),
  condition: z.string().optional().describe('The condition of the product (e.g., New, Like New, Good).'),
  images: z.array(z.string().url()).describe("A list of product photos as public URLs."),
});

export type GenerateDescriptionInput = z.infer<typeof GenerateDescriptionInputSchema>;

export const GenerateDescriptionOutputSchema = z.object({
  description: z.string().describe('The generated product description, between 100 and 200 words.'),
});

export type GenerateDescriptionOutput = z.infer<typeof GenerateDescriptionOutputSchema>;

export async function generateDescription(input: GenerateDescriptionInput): Promise<GenerateDescriptionOutput> {
  return generateDescriptionFlow(input);
}

const generationPrompt = ai.definePrompt({
  name: 'descriptionGenerator',
  input: { schema: GenerateDescriptionInputSchema },
  output: { schema: GenerateDescriptionOutputSchema },
  prompt: `You are a luxury fashion expert writing for MarigoApp, a high-end marketplace.

    Analyze the provided images and product details. Based on this information, write a compelling, professional, and enticing product description between 100 and 200 words.

    Highlight key features, materials, craftsmanship, and the overall style and appeal of the item. Be honest about the condition if details are provided.

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

const generateDescriptionFlow = ai.defineFlow(
  {
    name: 'generateDescriptionFlow',
    inputSchema: GenerateDescriptionInputSchema,
    outputSchema: GenerateDescriptionOutputSchema,
  },
  async (input) => {
    const { output } = await generationPrompt(input);
    return output!;
  }
);
