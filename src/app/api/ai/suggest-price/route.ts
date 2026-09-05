/**
 * Suggest an asking price for a listing from its photos and details.
 *
 * The panel in the sell wizard used to be hardcoded — a fixed "€280 - €350"
 * range and an "Apply €320" button, shown for every listing whatever its brand
 * — which was advice-shaped decoration. This is the real thing.
 *
 * Auth: a Firebase ID token is required, and the route is rate-limited before
 * the model call. Both are mandatory for anything spending model quota: the
 * Google AI free tier 429s at ~20 requests, so an open multimodal endpoint is
 * the cheapest way to take chat, search and descriptions down with it.
 *
 * **Prices returned are EUR**, like every stored price. The wizard converts
 * for display through `src/lib/price-conversion.ts`; nothing here knows about
 * lek.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { aiPriceSuggestionLimiter, applyRateLimit } from '@/lib/rate-limit';
import { generateText } from '@/ai/models';
import { verifyIdToken } from '@/lib/firebase-admin';

/**
 * Mirrors `SuggestPriceOutputSchema` in src/ai/flows/ai-suggest-price.ts.
 *
 * The flow itself is a `'use server'` action, which the Capacitor static
 * export cannot reach (§14) — hence a route. It also calls `ai.definePrompt`
 * directly, so it has no model failover; `generateText()` walks TEXT_FALLBACKS
 * when Google retires a model, which has taken this app down before.
 */
const SuggestionSchema = z.object({
  minPrice: z.number().describe('Lowest realistic asking price in EUR.'),
  maxPrice: z.number().describe('Highest realistic asking price in EUR.'),
  recommendedPrice: z.number().describe('The single price to recommend, in EUR, between min and max.'),
  reasoning: z.string().describe("1-2 sentences addressed to the seller on what drove the figure — brand, condition, item type. Never mention being an AI."),
});

const RequestSchema = z.object({
  images: z.array(z.string().startsWith('data:image/')).max(3).default([]),
  title: z.string().max(200).optional(),
  brand: z.string().max(120).optional(),
  category: z.string().max(120).optional(),
  condition: z.string().max(120).optional(),
});

export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, aiPriceSuggestionLimiter);
  if (limited) return limited;

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'You must be signed in to get a price suggestion.' }, { status: 401 });
    }
    try {
      await verifyIdToken(authHeader.slice(7));
    } catch {
      return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 });
    }

    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Could not read the listing details.' }, { status: 400 });
    }
    const { images, title, brand, category, condition } = parsed.data;

    // With neither photos nor a brand there is nothing to appraise, and a
    // confident number from no evidence is worse than no number.
    if (images.length === 0 && !brand?.trim() && !title?.trim()) {
      return NextResponse.json(
        { error: 'Add a photo or a brand first, then I can suggest a price.' },
        { status: 400 },
      );
    }

    const details = [
      title?.trim() && `- Title: ${title.trim()}`,
      brand?.trim() && `- Brand: ${brand.trim()}`,
      category?.trim() && `- Category: ${category.trim()}`,
      condition?.trim() && `- Condition: ${condition.trim()}`,
    ].filter(Boolean).join('\n');

    const prompt = `You are an experienced appraiser for MarigoApp, a marketplace for pre-owned designer fashion in Albania and the wider EU.

Suggest a realistic **second-hand** asking price in EUR for the item below.

Rules:
- Price the resale market, not retail. Allow for the condition you can see.
- Assume the item is authentic; that is checked separately.
- Judge from the photos and the details given. Do not invent facts about the item.
- If the brand is mass-market rather than luxury, price it accordingly — most
  stock here is everyday fashion, not couture, and an inflated range is worse
  than none.
- Give a min, a max, and one recommended price between them.
- Address the seller directly in the reasoning, in one or two sentences.

## The item
${details || '(no details given — judge from the photos alone)'}`;

    const response = await generateText({
      prompt: [
        { text: prompt },
        ...images.map((url) => ({ media: { url } })),
      ] as any,
      output: { schema: SuggestionSchema },
      config: { temperature: 0.2 },
    });

    const output = (response as any).output as z.infer<typeof SuggestionSchema> | undefined;
    if (!output) {
      return NextResponse.json({ error: 'Could not suggest a price just now.' }, { status: 502 });
    }

    // Guard the model's arithmetic rather than trusting it: an inverted range
    // or a recommendation outside its own bounds renders as nonsense.
    const min = Math.max(0, Math.min(output.minPrice, output.maxPrice));
    const max = Math.max(output.minPrice, output.maxPrice);
    const recommended = Math.min(Math.max(output.recommendedPrice, min), max);

    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= 0) {
      return NextResponse.json({ error: 'Could not suggest a price just now.' }, { status: 502 });
    }

    return NextResponse.json({
      minPrice: min,
      maxPrice: max,
      recommendedPrice: recommended,
      reasoning: output.reasoning,
    });
  } catch (error: any) {
    console.error('[suggest-price] failed:', error?.message || error);
    return NextResponse.json({ error: 'Could not suggest a price just now.' }, { status: 500 });
  }
}
