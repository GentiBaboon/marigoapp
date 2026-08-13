/**
 * Turn photos + a one-line hint into a pre-filled listing draft.
 *
 * The seller sends downscaled copies of their photos and something like
 * "Zara Black Satin Dress". The model reads the images, and its answer is then
 * snapped onto the live catalog vocabulary so every field can bind to the sell
 * wizard's selects. Nothing is written to Firestore here — the response is a
 * `Partial<SellFormValues>` that the client turns into a local draft, so the
 * seller reviews and publishes through the normal flow.
 *
 * Auth: a Firebase ID token is required. This route spends model quota, so it
 * is not open to anonymous callers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateText } from '@/ai/models';
import { verifyIdToken } from '@/lib/firebase-admin';
import { loadListingTaxonomy, matchOption } from '@/lib/listing-taxonomy';

/** Mirrors the AI-fillable subset of SellFormValues. */
const DraftSchema = z.object({
  title: z.string().describe('Short retail-style title, e.g. "Zara Black Satin Midi Dress". Max 70 chars.'),
  description: z.string().describe('2-4 sentences a buyer would find useful: cut, fabric feel, styling, visible wear. No invented facts.'),
  brand: z.string().describe('Brand name exactly as written on the label if visible, else from the hint.'),
  category: z.string().describe('Top-level category, e.g. Shoes, Bags, Clothing.'),
  subcategory: z.string().describe('Specific type, e.g. heels, dresses, handbag.'),
  gender: z.enum(['women', 'men', 'children', 'unisex']),
  condition: z.string().describe('Condition judged from the photos.'),
  color: z.string().describe('Dominant colour.'),
  material: z.string().describe('Main material, if identifiable from the photos.'),
  pattern: z.string().optional().describe('Pattern if there is an obvious one.'),
  size: z.string().optional().describe('Size if legible on a label in the photos. Omit if not visible — never guess.'),
  sizeSystem: z.string().optional().describe('EU, US, UK, IT, FR or International, when a size was read.'),
  suggestedPrice: z.number().describe('Realistic second-hand asking price in EUR.'),
  originalPrice: z.number().optional().describe('Estimated retail price when new, in EUR. Omit if unsure.'),
  vintage: z.boolean().optional(),
  confidenceNote: z.string().describe("One short sentence, addressed to the seller, on what you could not tell from the photos and should be checked. Empty string if nothing."),
});

const RequestSchema = z.object({
  /** Downscaled data URIs. The originals stay on the client for publishing. */
  images: z.array(z.string().startsWith('data:image/')).min(1).max(9),
  hint: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'You must be signed in to use the AI assistant.' }, { status: 401 });
    }
    try {
      await verifyIdToken(authHeader.slice(7));
    } catch {
      return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 });
    }

    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Add at least one photo (up to 9) to get started.' },
        { status: 400 },
      );
    }
    const { images, hint } = parsed.data;

    const taxonomy = await loadListingTaxonomy();

    // Give the model the real vocabulary. Brands are long, so only names are
    // listed; the rest are short enough to send whole.
    const options = (label: string, values: string[]) =>
      values.length ? `${label}: ${values.join(', ')}` : '';

    const vocabulary = [
      options('Categories', taxonomy.categories.map((c) => c.name)),
      options(
        'Sub-categories (parent in brackets)',
        taxonomy.subcategories.map((s) => `${s.name} [${s.parent}]`),
      ),
      options('Conditions', taxonomy.conditions.map((c) => c.name)),
      options('Colours', taxonomy.colors.map((c) => c.name)),
      options('Materials', taxonomy.materials.map((m) => m.name)),
      options('Patterns', taxonomy.patterns.map((p) => p.name)),
    ].filter(Boolean).join('\n\n');

    const prompt = `You are helping a seller list a second-hand fashion item on MarigoApp, a luxury resale marketplace.

Look at the photos and write the listing.

Rules:
- Describe ONLY what you can see. Never invent a material, a size or a detail that is not visible.
- If the seller's note names the brand, trust it over your own guess.
- Prefer values from the vocabulary below; it is what the listing form accepts.
- Read a size only if a label is legible in a photo. Otherwise omit it.
- Price in EUR for the *second-hand* market, allowing for the visible condition.
- Write the title and description in English, the language of the catalog.

## Vocabulary the form accepts
${vocabulary || '(unavailable — use plain descriptive words)'}

## The seller's note
${hint?.trim() || '(none given — rely on the photos)'}`;

    // Genkit takes media parts alongside the text prompt.
    const response = await generateText({
      prompt: [
        { text: prompt },
        ...images.map((url) => ({ media: { url } })),
      ] as any,
      output: { schema: DraftSchema },
      config: { temperature: 0.2 },
    });

    const out = response.output as z.infer<typeof DraftSchema> | null;
    if (!out) {
      return NextResponse.json(
        { error: 'The assistant could not read those photos. Try clearer, well-lit images.' },
        { status: 502 },
      );
    }

    // Snap onto real options. Unmatched fields are left out so the wizard shows
    // them as empty rather than displaying a value it cannot select.
    const subcategoryValue = matchOption(out.subcategory, taxonomy.subcategories);
    const subcategory = taxonomy.subcategories.find((s) => s.value === subcategoryValue);

    return NextResponse.json({
      draft: {
        title: out.title?.slice(0, 80),
        description: out.description,
        brandId: matchOption(out.brand, taxonomy.brands) ?? out.brand?.trim() ?? '',
        categoryId:
          matchOption(out.category, taxonomy.categories) ??
          (subcategory ? subcategory.parent : ''),
        subcategoryId: subcategory?.value ?? '',
        gender: out.gender,
        condition: matchOption(out.condition, taxonomy.conditions) ?? '',
        color: matchOption(out.color, taxonomy.colors) ?? '',
        material: matchOption(out.material, taxonomy.materials) ?? '',
        pattern: matchOption(out.pattern, taxonomy.patterns) ?? '',
        sizeValue: out.size?.trim() || '',
        sizeSystem: out.sizeSystem?.trim() || '',
        price: Number.isFinite(out.suggestedPrice) ? Math.max(0, Math.round(out.suggestedPrice)) : 0,
        originalPrice:
          typeof out.originalPrice === 'number' && out.originalPrice > out.suggestedPrice
            ? Math.round(out.originalPrice)
            : undefined,
        vintage: Boolean(out.vintage),
      },
      note: out.confidenceNote?.trim() || '',
    });
  } catch (error: any) {
    const message = error?.originalMessage || error?.message || '';
    console.error('AI draft-listing error:', message || error);

    const isQuota =
      error?.status === 'RESOURCE_EXHAUSTED' ||
      error?.code === 429 ||
      /quota|rate limit|too many requests/i.test(message);

    return NextResponse.json(
      {
        error: isQuota
          ? 'The AI assistant is busy right now. Wait a moment and try again, or list manually.'
          : 'Something went wrong reading those photos. You can still list manually.',
      },
      { status: isQuota ? 429 : 500 },
    );
  }
}
