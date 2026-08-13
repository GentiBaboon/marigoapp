import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  // Default model for definePrompt/defineFlow calls that don't name one.
  // Without this, every generate() call fails with INVALID_ARGUMENT.
  //
  // Not imported from ./models to avoid a cycle (models.ts imports `ai` from
  // here). Keep this literal in step with TEXT_MODEL's default there; callers
  // that want retirement-proof failover should use generateText() instead of
  // relying on this default.
  model: process.env.GENAI_TEXT_MODEL || 'googleai/gemini-2.5-flash',
});