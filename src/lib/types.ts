
'use client';
import { z } from "zod";
import { Timestamp, FieldValue } from "firebase/firestore";

// --- Base Types ---
export type FirestoreTimestamp = Timestamp | FieldValue | { seconds: number; nanoseconds: number };

// --- Auth & User ---
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

export interface FirestoreUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: "buyer" | "seller" | "courier" | "admin";
  profileImage: string | null;
  bio?: string | null;
  language: "sq" | "en" | "it";
  currency: "EUR" | "ALL" | "USD";
  stripeCustomerId?: string | null;
  stripeAccountId?: string | null;
  isSeller?: boolean;
  rating: number;
  reviewCount: number;
  createdAt: FirestoreTimestamp;
  lastLoginAt: FirestoreTimestamp;
  status: 'active' | 'banned';
  hasAcceptedChatRules?: boolean;
  emailPreferences?: {
    marketing: boolean;
    productUpdates: boolean;
    orderUpdates: boolean;
  };
}

// --- Products ---
export type ProductStatus = "draft" | "pending_review" | "active" | "sold" | "removed" | "expired";

export interface ProductImage {
  url: string;
  thumbnailUrl?: string;
  position: number;
}

export interface FirestoreProduct {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  categoryId: string;
  subcategoryId: string;
  brandId: string;
  condition: string;
  listingType: "fixed_price" | "auction";
  price: number;
  originalPrice?: number;
  currency: "EUR";
  size?: string;
  color?: string;
  material?: string;
  gender: "women" | "men" | "children" | "unisex";
  images: ProductImage[];
  status: ProductStatus;
  views: number;
  wishlistCount: number;
  isFeatured: boolean;
  isAuthenticated: boolean;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  listingCreated: FirestoreTimestamp;
  vintage?: boolean;
  pattern?: string;
  shippingFromAddressId?: string;
  authenticityCheck?: {
    status: 'pending' | 'completed';
    confidence: 'high' | 'medium' | 'low';
    findings: string[];
  };
}

// --- Orders ---
export interface FirestoreOrder {
  id: string;
  orderNumber: string;
  buyerId: string;
  sellerIds: string[];
  items: Array<{
    id: string;
    title: string;
    price: number;
    brand: string;
    image: string;
    sellerId: string;
  }>;
  totalAmount: number;
  status: "pending_payment" | "processing" | "shipped" | "delivered" | "completed" | "cancelled" | "refunded";
  paymentMethod: "card" | "cod";
  paymentIntentId?: string;
  shippingAddress: AddressFormValues;
  createdAt: FirestoreTimestamp;
  couponCode?: string | null;
  discountAmount?: number;
}

// --- Shared Components ---
export const addressSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().min(6, "Valid phone number is required"),
  address: z.string().min(5, "Full street address is required"),
  city: z.string().min(2, "City is required"),
  postal: z.string().min(3, "Postal code is required"),
  country: z.string().min(2, "Country is required"),
});
export type AddressFormValues = z.infer<typeof addressSchema>;
export type FirestoreAddress = AddressFormValues & { id: string; isDefault: boolean; };

export const editProfileSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  phone: z.string().min(6, "Valid phone number is required"),
});
export type EditProfileValues = z.infer<typeof editProfileSchema>;

// --- Sell Flow State ---
export interface SellFormValues {
  images: Array<{ url: string; file?: File; position: number; name: string; type: string }>;
  gender: "women" | "men" | "children" | "unisex";
  categoryId: string;
  subcategoryId: string;
  brandId: string;
  title: string;
  description: string;
  origin?: string;
  yearOfPurchase: string;
  serialNumber?: string;
  packaging?: string[];
  condition: string;
  material: string;
  color: string;
  sizeValue?: string;
  pattern?: string;
  vintage: boolean;
  price: number;
  originalPrice?: number;
  listingType: "fixed_price" | "auction";
  allowOffers: boolean;
  shippingMethod: 'baboon' | 'other' | 'free';
  shippingFromAddressId: string;
}

export interface SellDraft {
  id: string;
  formData: Partial<SellFormValues>;
  currentStep: number;
  lastModified: number;
}

// --- Admin ---
export interface FirestoreAdminLog {
  id: string;
  adminId: string;
  adminName: string;
  actionType: string;
  details: string;
  targetId: string;
  timestamp: FirestoreTimestamp;
}

export interface FirestoreCategory {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  isActive: boolean;
}

export interface FirestoreBrand {
  id: string;
  name: string;
  slug: string;
  verified: boolean;
}

export interface FirestoreAttribute {
  id: string;
  name: string;
  value: string;
  hex?: string;
}

export interface FirestoreCoupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrderValue: number;
  isActive: boolean;
  usedCount: number;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
