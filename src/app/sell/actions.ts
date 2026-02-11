'use server';

import { suggestPrice, SuggestPriceInput } from '@/ai/flows/ai-suggest-price';

export async function getPriceSuggestion(data: SuggestPriceInput) {
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
