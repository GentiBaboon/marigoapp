'use client';
import { z } from "zod";

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

// --- User & Profile ---
export const firestoreUserSchema = z.object({
  id: z.string(),
  displayName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  photoURL: z.string().url().optional().nullable(),
  macroCategoryPreference: z.enum(["womenswear", "menswear"]).optional(),
  isSeller: z.boolean().optional(),
  createdAt: z.any().optional(),
  status: z.enum(['active', 'banned']).optional(),
  isCourier: z.boolean().optional(),
  courierStatus: z.enum(['pending_approval', 'approved', 'rejected']).optional(),
});
export type FirestoreUser = z.infer<typeof firestoreUserSchema>;

// --- Sell Flow Schemas (6 Steps) ---

export const sellStep1Schema = z.object({
  images: z.array(z.object({
    url: z.string(),
    name: z.string(),
    type: z.string(),
    isProcessed: z.boolean().optional(),
  })).min(3, "At least 3 photos are required").max(8, "Maximum 8 photos allowed"),
});

export const sellStep2Schema = z.object({
  gender: z.string().min(1, "Please select a gender"),
  category: z.string().min(1, "Category is required"),
  subCategory: z.string().min(1, "Subcategory is required"),
  brand: z.string().min(1, "Brand is required"),
});

export const sellStep3Schema = z.object({
  title: z.string().min(5, "Title too short").max(80, "Title too long"),
  model: z.string().optional(),
  color: z.string().min(1, "Color is required"),
  material: z.string().min(1, "Material is required"),
  size: z.string().min(1, "Size is required"),
  year: z.string().optional(),
  description: z.string().min(50, "Description must be at least 50 characters"),
  authenticity: z.array(z.string()).optional(),
});

export const sellStep4Schema = z.object({
  condition: z.enum(['new_tags', 'new_no_tags', 'excellent', 'very_good', 'good']),
  defects: z.string().optional(),
});

export const sellStep5Schema = z.object({
  price: z.number().min(1, "Price must be at least 1 EUR"),
  allowOffers: z.boolean().default(true),
  minOfferPrice: z.number().optional(),
  shippingFrom: z.string().min(1, "City is required"),
  shippingMethod: z.enum(['baboon', 'other', 'free']),
  dispatchTime: z.enum(['1_day', '2_3_days', '1_week']),
});

export const sellFormSchema = sellStep1Schema
  .merge(sellStep2Schema)
  .merge(sellStep3Schema)
  .merge(sellStep4Schema)
  .merge(sellStep5Schema);

export type SellFormValues = z.infer<typeof sellFormSchema>;

export interface SellDraft {
  id: string;
  formData: Partial<SellFormValues>;
  currentStep: number;
  lastModified: number;
}

// --- Address ---
export const addressSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(6),
  address: z.string().min(5),
  city: z.string().min(2),
  postal: z.string().min(3),
  country: z.string().min(2),
});
export type AddressFormValues = z.infer<typeof addressSchema>;
export type FirestoreAddress = AddressFormValues & { id: string; isDefault: boolean; };

// --- Products & Orders ---
export type FirestoreProduct = {
  id: string;
  sellerId: string;
  title: string;
  brand: string;
  description: string;
  price: number;
  category: string;
  subCategory: string;
  images: string[];
  status: 'active' | 'sold' | 'reserved' | 'pending_review' | 'rejected' | 'draft';
  listingCreated: any;
  condition: string;
  color?: string;
  material?: string;
  size?: string;
};

export type FirestoreOrder = {
  id: string;
  orderNumber: string;
  buyerId: string;
  sellerIds: string[];
  items: any[];
  totalAmount: number;
  status: string;
  paymentMethod: string;
  createdAt: any;
};
