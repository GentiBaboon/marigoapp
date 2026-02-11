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

// --- Checkout Schemas ---

export const addressSchema = z.object({
  fullName: z.string().min(2, "Full name is required."),
  phone: z.string().min(6, "A valid phone number is required."),
  address: z.string().min(5, "Street address is required."),
  city: z.string().min(2, "City is required."),
  postal: z.string().min(3, "Postal code is required."),
  country: z.string().min(2, "Country is required."),
});

export type AddressFormValues = z.infer<typeof addressSchema>;

// --- Sell Schemas ---

export const sellStep1Schema = z.object({
  gender: z.enum(['womenswear', 'menswear', 'girlswear', 'boyswear'], { required_error: 'Please select a type.' }),
  category: z.string().min(1, 'Please select a category.'),
  brand: z.string().min(1, 'Brand is required.'),
});

export const sellStep2Schema = z.object({
  condition: z.enum(['new', 'like_new', 'good', 'fair'], { required_error: 'Please select a condition.' }),
  color: z.string().min(1, 'Please select a color.'),
  material: z.string().min(2, 'Material is required.'),
});

export const sellStep3Schema = z.object({
  images: z.array(z.object({ file: z.any(), preview: z.string() })).min(1, 'At least one image is required.').max(10, 'You can upload a maximum of 10 images.'),
});

export const sellStep4Schema = z.object({
    title: z.string().min(10, 'Title must be at least 10 characters.').max(70, 'Title must be 70 characters or less.'),
    description: z.string().min(20, 'Description must be at least 20 characters.').max(500, 'Description cannot exceed 500 characters.'),
    size: z.string().min(1, 'Please select a size.'),
});

export const sellStep5Schema = z.object({
    price: z.preprocess(
        (a) => {
            if (typeof a === 'string') return parseFloat(a);
            return a;
        },
        z.number().min(1, "Price must be at least 1.")
    ),
    currency: z.enum(['EUR', 'ALL'], { required_error: 'A currency is required.' }),
});

export const sellFormSchema = sellStep1Schema.merge(sellStep2Schema).merge(sellStep3Schema).merge(sellStep4Schema).merge(sellStep5Schema);

export type SellFormValues = z.infer<typeof sellFormSchema>;
