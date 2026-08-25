import { NextRequest, NextResponse } from 'next/server';
import { aiDescriptionLimiter, applyRateLimit } from '@/lib/rate-limit';
import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateDescriptionInputSchema = z.object({
  title: z.string(),
  brand: z.string(),
  category: z.string(),
  condition: z.string().optional(),
  images: z.array(z.string()),
});

const GenerateDescriptionOutputSchema = z.object({
  description: z.string(),
});

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

export async function POST(request: NextRequest) {
  // Rate limit before any model call — see src/lib/rate-limit.ts for why these
  // routes are the cheapest way to take the whole AI surface down.
  const limited = applyRateLimit(request, aiDescriptionLimiter);
  if (limited) return limited;

  try {
    const body = await request.json();
    const parsed = GenerateDescriptionInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { output } = await generationPrompt(parsed.data);
    return NextResponse.json(output!);
  } catch (error) {
    console.error('Generate description error:', error);
    return NextResponse.json({ error: 'Failed to generate description' }, { status: 500 });
  }
}
