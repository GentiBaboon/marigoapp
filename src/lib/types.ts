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


// --- Auth Schemas ---

export const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters long." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters long." }),
  terms: z.boolean().refine(val => val === true, {
    message: "You must accept the terms and conditions.",
  }),
});

export type SignupValues = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
