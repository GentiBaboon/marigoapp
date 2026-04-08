import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { z } from 'zod';

const RemoveBackgroundInputSchema = z.object({
  imageDataUri: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RemoveBackgroundInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { media } = await ai.generate({
      model: 'googleai/gemini-2.5-flash-image',
      prompt: [
        { media: { url: parsed.data.imageDataUri } },
        { text: 'Remove the background of this luxury fashion item and place it on a clean, professional, pure studio white background. Ensure the item is the sole focus and its colors are preserved.' },
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media) {
      return NextResponse.json({ error: 'AI could not process this image' }, { status: 500 });
    }

    return NextResponse.json({ enhancedImageDataUri: media.url });
  } catch (error) {
    console.error('Remove background error:', error);
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}
