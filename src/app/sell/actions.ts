'use server';

import { suggestPrice, SuggestPriceInput, SuggestPriceOutput } from '@/ai/flows/ai-suggest-price';

export async function getPriceSuggestion(data: SuggestPriceInput): Promise<{ success: boolean; data?: SuggestPriceOutput, error?: string; }> {
  try {
    const result = await suggestPrice(data);
    return { success: true, data: result };
  } catch (error) {
    console.error('AI price suggestion failed:', error);
    return {
      success: false,
      error: 'Failed to get price suggestion. Please try again.',
    };
  }
}
