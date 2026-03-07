'use server';

import { z } from 'zod';

const productValidationSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(99, 'Title must be under 100 characters.'),
  description: z.string().min(1, 'Description is required.'),
  brand: z.string().min(1, 'Brand is required.'),
  category: z.string().min(1, 'Category is required.'),
  price: z.number().gt(0, 'Price must be greater than 0.'),
  condition: z.string().min(1, 'Condition is required.'),
  material: z.string().min(1, 'Material is required.'),
  color: z.string().min(1, 'Color is required.'),
  imageCount: z.number().min(3, 'At least 3 photos are required.').max(15, 'Maximum 15 photos allowed.'),
});

export type ValidateListingInput = z.infer<typeof productValidationSchema>;

export async function validateListing(data: ValidateListingInput): Promise<{
  success: boolean;
  errors?: { field: string; message: string }[];
}> {
  const result = productValidationSchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(issue => ({
        field: issue.path[0] as string,
        message: issue.message,
      })),
    };
  }

  return { success: true };
}
