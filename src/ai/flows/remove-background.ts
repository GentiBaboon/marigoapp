'use server';
/**
 * @fileOverview AI flow for removing backgrounds and enhancing product photos.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

const RemoveBackgroundInputSchema = z.object({
  imageDataUri: z.string().describe("The product image as a data URI."),
});

const RemoveBackgroundOutputSchema = z.object({
  enhancedImageDataUri: z.string().describe("The image with a clean studio white background."),
});

export async function removeBackground(input: z.infer<typeof RemoveBackgroundInputSchema>) {
  return removeBackgroundFlow(input);
}

const removeBackgroundFlow = ai.defineFlow(
  {
    name: 'removeBackgroundFlow',
    inputSchema: RemoveBackgroundInputSchema,
    outputSchema: RemoveBackgroundOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.5-flash-image',
      prompt: [
        { media: { url: input.imageDataUri } },
        { text: 'Remove the background of this luxury fashion item and place it on a clean, professional, pure studio white background. Ensure the item is the sole focus and its colors are preserved.' },
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media) {
      throw new Error('AI could not process this image.');
    }

    return { enhancedImageDataUri: media.url };
  }
);
