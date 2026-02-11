'use server';

import { suggestPrice, SuggestPriceInput } from '@/ai/flows/ai-suggest-price';
import type { SellFormValues } from '@/lib/types';


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

export async function createListing(data: Partial<SellFormValues>) {
  // TODO: Implement actual listing creation logic (e.g., save to Firestore)
  console.log('Creating listing with data:', data);
  // Simulate a network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // In a real app, you'd get the ID from the database
  const newListingId = `prod_${Date.now()}`;

  return { success: true, listingId: newListingId };
}
