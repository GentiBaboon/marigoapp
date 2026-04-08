'use client';
import { z } from "zod";
import { Timestamp, FieldValue } from "firebase/firestore";

// --- Base Types ---
export type FirestoreTimestamp = Timestamp | FieldValue | { seconds: number; nanoseconds: number };

/**
 * Safely convert a FirestoreTimestamp to a JS Date.
 * Handles Timestamp objects, raw {seconds, nanoseconds}, and ISO strings.
 */
export function toDate(ts: FirestoreTimestamp | string | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof ts === 'string') return new Date(ts);
  if (typeof (ts as any).toDate === 'function') return (ts as any).toDate();
  if (typeof (ts as any).seconds === 'number') return new Date((ts as any).seconds * 1000);
  return null;
}

// --- Status Enums (single source of truth for all status values) ---

export const ProductStatusEnum = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  ACTIVE: 'active',
  SOLD: 'sold',
  REMOVED: 'removed',
  EXPIRED: 'expired',
  RESERVED: 'reserved',
} as const;

export const OrderStatusEnum = {
  PENDING_PAYMENT: 'pending_payment',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

export const UserStatusEnum = {
  ACTIVE: 'active',
  BANNED: 'banned',
} as const;

export const UserRoleEnum = {
  BUYER: 'buyer',
  SELLER: 'seller',
  COURIER: 'courier',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  MODERATOR: 'moderator',
  ANALYST: 'analyst',
} as const;

export const DeliveryStatusEnum = {
  PENDING_ASSIGNMENT: 'pending_assignment',
  ASSIGNED: 'assigned',
  ARRIVED_FOR_PICKUP: 'arrived_for_pickup',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  ARRIVED_FOR_DELIVERY: 'arrived_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export const ReportStatusEnum = {
  PENDING: 'pending',
  RESOLVED: 'resolved',
} as const;

export const OfferStatusEnum = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
} as const;

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

export const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export interface FirestoreUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: "buyer" | "seller" | "courier" | "admin" | "super_admin" | "moderator" | "analyst";
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
  isCourier?: boolean;
  courierStatus?: 'pending_approval' | 'approved' | 'rejected';
  kycStatus?: 'not_started' | 'pending' | 'approved' | 'rejected';
  kycDocuments?: Array<{ url: string; type: string; uploadedAt: string }>;
  isVerifiedSeller?: boolean;
  kycRejectionReason?: string;
}

// --- Products ---
export type ProductStatus = "draft" | "pending_review" | "active" | "sold" | "removed" | "expired" | "reserved";

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
  taxAmount?: number;
  taxRate?: number;
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
export const sellStep2Schema = z.object({
  gender: z.enum(["women", "men", "children", "unisex"]),
  categoryId: z.string().min(1, "Category is required"),
  subcategoryId: z.string().min(1, "Subcategory is required"),
  brandId: z.string().min(1, "Brand is required"),
});

export const sellStep3Schema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  origin: z.string().optional(),
  yearOfPurchase: z.string().min(1, "Year is required"),
  serialNumber: z.string().optional(),
  packaging: z.array(z.string()).optional(),
});

export const sellStep4Schema = z.object({
  condition: z.string().min(1, "Condition is required"),
  material: z.string().min(1, "Material is required"),
  color: z.string().min(1, "Color is required"),
  sizeValue: z.string().optional(),
  pattern: z.string().optional(),
  vintage: z.boolean().default(false),
});

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

// --- Courier & Logistics ---
export const courierApplicationSchema = z.object({
  legalName: z.string().min(2, "Full name is required"),
  dob: z.date({ required_error: "Date of birth is required" }),
  phone: z.string().min(6, "Phone is required"),
  vehicleType: z.enum(["bicycle", "scooter", "car", "van"], { required_error: "Vehicle type is required" }),
  licensePlate: z.string().min(2, "License plate is required"),
  serviceAreas: z.string().min(2, "Service areas are required"),
  availability: z.array(z.string()).min(1, "Select at least one day"),
});
export type CourierApplicationValues = z.infer<typeof courierApplicationSchema>;

export interface FirestoreCourierProfile {
  id: string;
  userId: string;
  legalName: string;
  dob: string;
  phone: string;
  vehicleType: "bicycle" | "scooter" | "car" | "van";
  licensePlate: string;
  serviceAreas: string;
  availability: string[];
  isAvailable: boolean;
  rating?: number;
  deliveriesCount?: number;
}

export interface FirestoreDelivery {
  id: string;
  orderId: string;
  courierId?: string;
  status: 'pending_assignment' | 'assigned' | 'arrived_for_pickup' | 'picked_up' | 'in_transit' | 'arrived_for_delivery' | 'delivered' | 'cancelled';
  packageSize: 'small' | 'medium' | 'large';
  deliveryFee: number;
  distance?: number;
  timeEstimate?: number;
  addresses: {
    pickup: AddressFormValues;
    delivery: AddressFormValues;
  };
  history?: Array<{
    status: string;
    timestamp: FirestoreTimestamp;
  }>;
  specialInstructions?: string;
  proofOfPickup?: string;
  pickupSignature?: string;
  pickupNotes?: string;
}

// --- Admin & Metadata ---
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
  usageLimit?: number;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export interface FirestoreSettings {
  isFreeDeliveryActive: boolean;
  freeDeliveryThreshold: number;
  commissionRate?: number;
  taxEnabled?: boolean;
  taxRate?: number;
  taxLabel?: string;
}

// --- Messaging ---
export interface FirestoreConversation {
  id: string;
  participants: string[];
  participantDetails: Array<{ userId: string; name: string; avatar?: string }>;
  productId: string;
  productTitle: string;
  productImage: string;
  lastMessage: string;
  lastMessageAt: FirestoreTimestamp;
  unreadCount: Record<string, number>;
}

export interface FirestoreMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: FirestoreTimestamp;
  read: boolean;
}

// --- Reviews & Notifications ---
export interface FirestoreReview {
  id: string;
  orderId: string;
  productId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  content: string;
  createdAt: FirestoreTimestamp;
}

export interface FirestoreNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'offer_received' | 'item_sold' | 'new_message' | 'order_update' | 'review_received' | 'welcome' | 'listing_suggestion' | 'default';
  read: boolean;
  createdAt: FirestoreTimestamp;
  data?: {
    link?: string;
    imageUrl?: string;
    [key: string]: any;
  };
}

export interface FirestoreReport {
  id: string;
  type: 'product' | 'user' | 'message' | 'review';
  itemId: string;
  reporterId: string;
  reason: string;
  status: 'pending' | 'resolved';
  createdAt: FirestoreTimestamp;
}

// --- Payment ---
export interface FirestorePaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  stripePaymentMethodId: string;
}

export interface FirestoreOffer {
  id: string;
  buyerId: string;
  buyerName: string;
  amount: number;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: FirestoreTimestamp;
}

// --- Chat Commerce ---
export interface ChatProductCard {
  id: string;
  title: string;
  price: number;
  image: string;
  brandId: string;
  sellerId: string;
}

export type SupportMessageType = 'text' | 'product_card';

// --- Refunds ---
export const RefundStatusEnum = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PROCESSED: 'processed',
} as const;

export interface FirestoreRefund {
  id: string;
  orderId: string;
  orderNumber: string;
  requestedBy: string;
  requestedByName: string;
  reason: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  adminNotes?: string;
  processedBy?: string;
  createdAt: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

// --- Disputes ---
export interface DisputeMessage {
  senderId: string;
  senderName: string;
  senderRole: 'buyer' | 'seller' | 'admin';
  content: string;
  createdAt: string;
}

export interface FirestoreDispute {
  id: string;
  orderId: string;
  orderNumber: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  reason: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  messages: DisputeMessage[];
  resolution?: string;
  createdAt: FirestoreTimestamp;
  resolvedAt?: FirestoreTimestamp;
  resolvedBy?: string;
}

// --- Returns ---
export const ReturnStatusEnum = {
  REQUESTED: 'requested',
  APPROVED: 'approved',
  SHIPPING: 'shipping',
  RECEIVED: 'received',
  REFUNDED: 'refunded',
  EXCHANGED: 'exchanged',
  REJECTED: 'rejected',
} as const;

export interface FirestoreReturn {
  id: string;
  orderId: string;
  orderNumber: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  items: Array<{ id: string; title: string; price: number; image: string }>;
  type: 'return' | 'exchange';
  reason: string;
  status: 'requested' | 'approved' | 'shipping' | 'received' | 'refunded' | 'exchanged' | 'rejected';
  adminNotes?: string;
  processedBy?: string;
  createdAt: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}
