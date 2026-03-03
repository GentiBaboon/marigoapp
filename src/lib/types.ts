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
  name: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  role: z.enum(["buyer", "seller", "courier", "admin"]).default("buyer"),
  profileImage: z.string().url().optional().nullable(),
  bio: z.string().optional().nullable(),
  language: z.enum(["sq", "en", "it"]).default("en"),
  currency: z.enum(["EUR", "ALL", "USD"]).default("EUR"),
  stripeCustomerId: z.string().optional().nullable(),
  stripeAccountId: z.string().optional().nullable(),
  rating: z.number().default(0),
  reviewCount: z.number().default(0),
  createdAt: any().optional(),
  lastLoginAt: any().optional(),
  status: z.enum(['active', 'banned']).default("active"),
  hasAcceptedChatRules: z.boolean().optional(),
  emailPreferences: z.object({
    marketing: z.boolean().default(true),
    productUpdates: z.boolean().default(true),
    orderUpdates: z.boolean().default(true),
  }).optional(),
});
export type FirestoreUser = z.infer<typeof firestoreUserSchema>;

// --- Sell Flow Schemas ---
export const sellStep1Schema = z.object({
  images: z.array(z.object({
    url: z.string(),
    name: z.string(),
    type: z.string(),
    thumbnailUrl: z.string().optional(),
    position: z.number(),
  })).min(3, "At least 3 photos are required").max(8, "Maximum 8 photos allowed"),
});

export const sellStep2Schema = z.object({
  gender: z.enum(["women", "men", "children", "unisex"]),
  categoryId: z.string().min(1, "Category is required"),
  subcategoryId: z.string().min(1, "Subcategory is required"),
  brandId: z.string().min(1, "Brand is required"),
});

export const sellStep3Schema = z.object({
  title: z.string().min(5, "Title too short").max(80, "Title too long"),
  description: z.string().min(50, "Description must be at least 50 characters"),
  origin: z.string().optional(),
  yearOfPurchase: z.string().min(1, "Year is required"),
  serialNumber: z.string().optional(),
  packaging: z.array(z.string()).optional(),
});

export const sellStep4Schema = z.object({
  condition: z.string().min(1, "Condition is required"),
  material: z.string().min(1, "Material is required"),
  color: z.string().min(1, "Color is required"),
  size: z.string().optional(),
  sizeStandard: z.string().optional(),
  sizeValue: z.string().optional(),
  pattern: z.string().optional(),
  vintage: z.boolean().optional(),
  proofOfOrigin: z.array(z.any()).optional(),
});

export const sellStep5Schema = z.object({
  price: z.number().min(1, "Price must be at least 1 EUR"),
  originalPrice: z.number().optional(),
  listingType: z.enum(["fixed_price", "auction"]).default("fixed_price"),
  allowOffers: z.boolean().default(true),
  shippingMethod: z.enum(['baboon', 'other', 'free']).optional(),
  shippingFromAddressId: z.string().min(1, "Shipping address is required"),
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
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().min(6, "Valid phone number is required"),
  address: z.string().min(5, "Full street address is required"),
  city: z.string().min(2, "City is required"),
  postal: z.string().min(3, "Postal code is required"),
  country: z.string().min(2, "Country is required"),
});
export type AddressFormValues = z.infer<typeof addressSchema>;
export type FirestoreAddress = AddressFormValues & { id: string; isDefault: boolean; };

// --- Edit Profile ---
export const editProfileSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  phone: z.string().min(6, "Valid phone number is required"),
});
export type EditProfileValues = z.infer<typeof editProfileSchema>;

// --- Products & Orders ---
export type FirestoreProduct = {
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
  images: {
    url: string;
    thumbnailUrl?: string;
    position: number;
  }[];
  status: "draft" | "pending_review" | "active" | "sold" | "removed" | "expired";
  views: number;
  wishlistCount: number;
  isFeatured: boolean;
  isAuthenticated: boolean;
  createdAt: any;
  updatedAt: any;
  listingCreated: any;
  authenticityCheck?: {
    status: 'pending' | 'completed';
    confidence: 'high' | 'medium' | 'low';
    findings: string[];
  };
  vintage?: boolean;
  pattern?: string;
  shippingFromAddressId?: string;
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
  paymentIntentId?: string;
  shippingAddress: AddressFormValues;
  createdAt: any;
};

export type FirestoreNotification = {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: any;
    read: boolean;
    createdAt: any;
};

export type FirestoreConversation = {
    id: string;
    participants: string[];
    participantDetails: {
        userId: string;
        name: string;
        avatar: string;
    }[];
    productId: string;
    productTitle: string;
    productImage: string;
    lastMessage: string;
    lastMessageAt: any;
    unreadCount: Record<string, number>;
};

export type FirestoreMessage = {
    id: string;
    senderId: string;
    content: string;
    createdAt: any;
    read: boolean;
};

export type FirestoreOffer = {
    id: string;
    buyerId: string;
    amount: number;
    message?: string;
    status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'withdrawn' | 'expired';
    counterAmount?: number;
    expiresAt?: any;
    createdAt: any;
    sellerId: string;
    offerAmount: number;
    history?: any[];
};

export type FirestoreDelivery = {
    id: string;
    orderId: string;
    courierId: string;
    status: string;
    deliveryFee: number;
    packageSize: string;
    distance?: number;
    timeEstimate?: number;
    specialInstructions?: string;
    addresses: {
        pickup: FirestoreAddress;
        delivery: FirestoreAddress;
    };
    history?: { status: string; timestamp: any }[];
    proofOfPickup?: string;
    pickupSignature?: string;
    pickupNotes?: string;
};

export type FirestoreCourierProfile = {
    id: string;
    userId: string;
    legalName: string;
    vehicleType: string;
    isAvailable: boolean;
};

export type FirestoreReport = {
    id: string;
    reporterId: string;
    type: 'product' | 'user' | 'message' | 'review';
    itemId: string;
    reason: string;
    status: 'pending' | 'resolved';
};

export type FirestoreAdminLog = {
    id: string;
    adminId: string;
    adminName: string;
    actionType: string;
    details: string;
    targetId: string;
    timestamp: any;
};

export type FirestoreSettings = {
    commissionRate: number;
    maintenanceMode: boolean;
    imageMaxSizeMB?: number;
    imageMaxDimension?: number;
    imageCompressionQuality?: number;
};

export type FirestoreCategory = {
    id: string;
    name: string;
    slug: string;
    parentId?: string | null;
    isActive: boolean;
};

export type FirestoreBrand = {
    id: string;
    name: string;
    slug: string;
    verified: boolean;
};

export type FirestoreAttribute = {
    id: string;
    name: string;
    value: string;
    hex?: string;
};

export type ProofFile = {
    url: string;
    name: string;
    type: string;
};

export type FirestoreReview = {
    id: string;
    orderId: string;
    productId: string;
    reviewerId: string;
    revieweeId: string;
    rating: number;
    content: string;
    createdAt: any;
};

export type FirestorePaymentMethod = {
    id: string;
    stripePaymentMethodId: string;
    type: string;
    last4: string;
    brand: string;
    isDefault: boolean;
};
