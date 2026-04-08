/**
 * @fileOverview Client helper for AI product description generation.
 * Server logic lives in /api/ai/generate-description/route.ts.
 */
import { z } from 'zod';

export const GenerateDescriptionInputSchema = z.object({
  title: z.string(),
  brand: z.string(),
  category: z.string(),
  condition: z.string().optional(),
  images: z.array(z.string()),
});

export type GenerateDescriptionInput = z.infer<typeof GenerateDescriptionInputSchema>;

export const GenerateDescriptionOutputSchema = z.object({
  description: z.string(),
});

export type GenerateDescriptionOutput = z.infer<typeof GenerateDescriptionOutputSchema>;

export async function generateDescription(input: GenerateDescriptionInput): Promise<GenerateDescriptionOutput> {
  const res = await fetch('/api/ai/generate-description', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate description');
  }

  return res.json();
}
