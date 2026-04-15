/**
 * @fileOverview Client helper for AI background removal.
 * Server logic lives in /api/ai/remove-background/route.ts.
 */
import { z } from 'zod';

const RemoveBackgroundInputSchema = z.object({
  imageDataUri: z.string(),
});

const RemoveBackgroundOutputSchema = z.object({
  enhancedImageDataUri: z.string(),
});

export type RemoveBackgroundOutput = z.infer<typeof RemoveBackgroundOutputSchema>;

export async function removeBackground(input: z.infer<typeof RemoveBackgroundInputSchema>): Promise<RemoveBackgroundOutput> {
  const res = await fetch('/api/ai/remove-background', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to remove background');
  }

  return res.json();
}
