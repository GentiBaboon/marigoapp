import { z } from "zod";

export const priceSuggestionSchema = z.object({
  category: z.string().min(3, "Category must be at least 3 characters long."),
  brand: z.string().min(2, "Brand must be at least 2 characters long."),
  condition: z.enum(["new", "like-new", "used"], {
    required_error: "You need to select a condition.",
  }),
  description: z.string().min(10, "Description must be at least 10 characters.").max(1000),
  currency: z.enum(["EUR", "ALL"], {
    required_error: "You need to select a currency.",
  }),
});

export type PriceSuggestionFormValues = z.infer<typeof priceSuggestionSchema>;
