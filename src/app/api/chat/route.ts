/**
 * MarigoAI chat endpoint.
 *
 * Shape of a turn:
 *   1. Retrieve first (no LLM) — match the message against the live brand /
 *      category catalog and active listings. Deterministic, so "a keni Zara?"
 *      works identically in both languages and keeps working if the model is
 *      rate-limited.
 *   2. Generate once, with the retrieved listings, the platform knowledge and
 *      the visitor's auth state as context. The model writes prose and picks
 *      links; it never invents either.
 *   3. Validate the links against an allow-list before they reach the browser.
 *
 * Auth state arrives from the client as a plain boolean. It only changes the
 * assistant's wording ("sign in first"), never what data is returned — product
 * retrieval reads public collections only — so it is not a trust boundary.
 */

import { NextRequest, NextResponse } from 'next/server';
import { chatLimiter, applyRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import { generateText } from '@/ai/models';
import { ChatInputSchema } from '@/ai/flows/ai-chat';
import { retrieveForMessage } from '@/lib/chat-retrieval';
import {
  PLATFORM_KNOWLEDGE,
  CHAT_PERSONA,
  KNOWN_ROUTES,
  sanitizeChatLinks,
  detectChatLanguage,
  type ChatLocale,
} from '@/lib/chat-knowledge';

/** What we ask the model to return. Links come back structured, not inline. */
const ModelOutputSchema = z.object({
  reply: z.string().describe('The answer, in the same language the user wrote in.'),
  links: z
    .array(
      z.object({
        label: z.string().describe("Button text, in the user's language. Max 4 words."),
        href: z.string().describe('A site-relative path such as /sell or /auth/signup.'),
      }),
    )
    .max(3)
    .optional()
    .describe('Up to 3 places to send the visitor. Omit when none are useful.'),
});

/**
 * Answer without the model. Used when generation fails, so a visitor asking
 * "anything from Zara?" still gets their listings during an AI outage.
 */
function fallbackReply(language: ChatLocale, hasProducts: boolean): string {
  const isAlbanian = language === 'sq';
  if (hasProducts) {
    return isAlbanian
      ? 'Ja disa artikuj që gjeta për ju:'
      : 'Here are some items I found for you:';
  }
  return isAlbanian
    ? 'Më vjen keq, nuk po arrij të përgjigjem për momentin. Provoni përsëri pas pak, ose shikoni Qendrën e Ndihmës.'
    : "Sorry — I can't answer right now. Please try again shortly, or take a look at the Help Centre.";
}

export async function POST(request: NextRequest) {
  // Rate limit before any model call — see src/lib/rate-limit.ts for why these
  // routes are the cheapest way to take the whole AI surface down.
  const limited = applyRateLimit(request, chatLimiter);
  if (limited) return limited;

  let language: ChatLocale = 'en';
  let retrieval: Awaited<ReturnType<typeof retrieveForMessage>> = {
    products: [], facetLinks: [], matchedFacets: [], isProductQuery: false, isApproximate: false,
  };

  try {
    const parsed = ChatInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const {
      history, message, isSignedIn = false, gender = null, locale = 'en', userName = '',
    } = parsed.data;
    // Worked out here, not by the model: asking it to mirror the user's
    // language sent English questions back in Albanian.
    language = detectChatLanguage(message, locale);

    // ── 1. Ground the answer in real catalog data ──
    retrieval = await retrieveForMessage(message, gender);

    const approximateNote = retrieval.isApproximate
      ? '\nNOTE: these only PARTIALLY match what was asked for. Present them as' +
        ' similar or related items, and be clear you did not find an exact match.'
      : '';

    const productContext = retrieval.products.length
      ? retrieval.products
          .map(
            (p, i) =>
              `${i + 1}. "${p.title}" — brand: ${p.brandName || 'unknown'}, price: €${p.price}` +
              `${p.size ? `, size: ${p.size}` : ''}${p.condition ? `, condition: ${p.condition}` : ''}` +
              ` (the interface shows this listing as a card, so do not repeat its full details)`,
          )
          .join('\n') + approximateNote
      : retrieval.isProductQuery
        ? 'NONE — there are no matching listings on the site right now. Say so honestly.'
        : 'Not a product question; no listings were looked up.';

    const facetContext = retrieval.matchedFacets.length
      ? `Brands/categories recognised in the message: ${retrieval.matchedFacets.join(', ')}.\n` +
        `Useful filter links you may offer:\n${retrieval.facetLinks.map((l) => `- ${l.label} → ${l.href}`).join('\n')}`
      : 'No brand or category was named.';

    // ── 2. One grounded generation ──
    const prompt = `${CHAT_PERSONA}

## Platform knowledge (the only facts you may state)
${PLATFORM_KNOWLEDGE}

## Links you may use
Use only these paths, plus /products/<id> and /search?<filters> taken from the
context below. Never invent a path.
${Object.entries(KNOWN_ROUTES).map(([k, v]) => `- ${v} (${k})`).join('\n')}

## REPLY LANGUAGE
${language === 'sq' ? 'Albanian (shqip). Write the whole reply and all link labels in Albanian.' : 'English. Write the whole reply and all link labels in English.'}

## This visitor
- Signed in: ${isSignedIn ? 'YES' : 'NO — actions needing an account must start with signing up or signing in'}
- Name: ${userName || 'unknown — do not invent one, just skip the name'}
- Shopping department: ${gender ?? 'not set'}
Use their name sparingly — a greeting or a warm moment, not every message.

## Live catalog results for this message
${productContext}

${facetContext}

## Conversation so far
${history.length ? history.map((m) => `${m.role === 'user' ? 'User' : 'You'}: ${m.content}`).join('\n') : '(this is the first message)'}

## The user's new message
${message}

Reply now, in the REPLY LANGUAGE above. Keep it short, and put any destinations in "links".`;

    const llmResponse = await generateText({
      prompt,
      output: { schema: ModelOutputSchema },
      config: { temperature: 0.4 },
    });

    const output = llmResponse.output as z.infer<typeof ModelOutputSchema> | null;
    const reply = output?.reply?.trim();

    // ── 3. Validate links, then merge in the retrieval's own facet links ──
    const modelLinks = sanitizeChatLinks(output?.links);
    const links = sanitizeChatLinks([...modelLinks, ...retrieval.facetLinks]);

    return NextResponse.json({
      response: reply || fallbackReply(language, retrieval.products.length > 0),
      products: retrieval.products.length ? retrieval.products : undefined,
      links: links.length ? links : undefined,
    });
  } catch (error: any) {
    console.error('AI chat API error:', error?.originalMessage || error);

    // The model failed, but retrieval may already have succeeded — return what
    // we have rather than the old blanket "having trouble connecting".
    if (retrieval.products.length > 0) {
      return NextResponse.json({
        response: fallbackReply(language, true),
        products: retrieval.products,
        links: sanitizeChatLinks(retrieval.facetLinks),
      });
    }

    const isQuota =
      error?.status === 'RESOURCE_EXHAUSTED' ||
      error?.code === 429 ||
      /quota|rate limit/i.test(error?.originalMessage || error?.message || '');

    return NextResponse.json(
      {
        error: isQuota
          ? 'AI service is temporarily unavailable. Please try again in a moment.'
          : 'Failed to generate AI response',
        response: fallbackReply(language, false),
        links: [{ label: language === 'sq' ? 'Qendra e Ndihmës' : 'Help Centre', href: KNOWN_ROUTES.help }],
      },
      { status: isQuota ? 429 : 500 },
    );
  }
}
