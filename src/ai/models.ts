/**
 * @fileOverview Central Gemini model ids + a generate() wrapper that survives
 * model retirements.
 *
 * Why this file exists: `gemini-2.0-flash` was hardcoded in `genkit.ts` and in
 * the chat route. Google retired it and started returning
 *   404 "This model models/gemini-2.0-flash is no longer available"
 * which took down the chatbot, the price suggester, the description generator,
 * the recommender and smart-search all at once, with no way to recover without
 * a code deploy.
 *
 * So: one place to change the model, an env override to change it with no
 * deploy at all, and an automatic fallback to the next candidate when Google
 * retires the current one.
 */

import { ai } from '@/ai/genkit';

/** Text model used by the chatbot and the other text flows. */
export const TEXT_MODEL = process.env.GENAI_TEXT_MODEL || 'googleai/gemini-2.5-flash';

/** Image-capable model used by the background remover. */
export const IMAGE_MODEL = process.env.GENAI_IMAGE_MODEL || 'googleai/gemini-2.5-flash-image';

/**
 * Tried in order when the configured model is gone. Keep newest/cheapest first.
 * An explicit `GENAI_TEXT_MODEL` is always tried before this list.
 */
const TEXT_FALLBACKS = [
  'googleai/gemini-2.5-flash',
  'googleai/gemini-flash-latest',
  'googleai/gemini-2.5-pro',
];

/** Models that answered successfully, so we stop re-probing dead ones. */
let resolvedTextModel: string | null = null;

/** Google signals a retired/unknown model with 404 + this wording. */
function isModelGone(error: unknown): boolean {
  const message =
    (error as { originalMessage?: string })?.originalMessage ||
    (error as Error)?.message ||
    '';
  return (
    /404/.test(message) &&
    /(no longer available|not found|is not supported|unknown name)/i.test(message)
  );
}

type GenerateArgs = Omit<Parameters<typeof ai.generate>[0], 'model'>;

/**
 * `ai.generate()` with automatic failover across `TEXT_FALLBACKS`.
 *
 * Only a "model is gone" 404 advances to the next candidate — quota errors,
 * auth errors and bad requests are rethrown immediately, because retrying a
 * different model would just burn latency and produce the same failure.
 */
export async function generateText(args: GenerateArgs) {
  const candidates = resolvedTextModel
    ? [resolvedTextModel]
    : [TEXT_MODEL, ...TEXT_FALLBACKS.filter((m) => m !== TEXT_MODEL)];

  let lastError: unknown;

  for (const model of candidates) {
    try {
      const response = await ai.generate({ ...args, model } as Parameters<typeof ai.generate>[0]);
      resolvedTextModel = model;
      return response;
    } catch (error) {
      lastError = error;
      if (!isModelGone(error)) throw error;
      console.warn(`[ai] model ${model} is unavailable, trying the next candidate`);
    }
  }

  throw lastError;
}
