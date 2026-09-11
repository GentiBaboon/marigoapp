/**
 * @fileOverview Browser helper for AI product recommendations — no zod.
 * Same split as `chat-client.ts`: the schemas stay in
 * `flows/get-recommendations.ts` for the route; the homepage rail imports
 * only this.
 */
import type { RecommendationInput, RecommendationOutput } from './flows/get-recommendations';

export type { RecommendationInput, RecommendationOutput };

export async function getRecommendations(input: RecommendationInput): Promise<RecommendationOutput> {
  const res = await fetch('/api/ai/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to get recommendations');
  }

  return res.json();
}
