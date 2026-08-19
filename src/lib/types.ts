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
  /** Alias for `name` — used by Firebase Auth-derived shapes. */
  displayName?: string | null;
  email: string | null;
  phone: string | null;
  role: "buyer" | "seller" | "courier" | "admin" | "super_admin" | "moderator" | "analyst";
  profileImage: string | null;
  /** Alias for `profileImage` — used by Firebase Auth-derived shapes. */
  photoURL?: string | null;
  bio?: string | null;
  language: "sq" | "en";
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
  // Denormalized count of completed sales — drives the seller badge level.
  // Bumped when admin marks an order as completed in the order detail page.
  salesCount?: number;
  // Admin-controlled flag. When true, the seller gets the "Official Registered
  // Brand" badge regardless of sales count, AND unlocks multi-variant
  // (per-size inventory) listings.
  isOfficialBrand?: boolean;
  // Admin override for the seller badge. When set, takes precedence over the
  // auto-computed level derived from salesCount. `null` or unset → auto.
  badgeOverride?: SellerBadgeLevel | null;
}

export type SellerBadgeLevel = 'trusted' | 'expert' | 'activist' | 'official';

export interface SellerBadge {
  level: SellerBadgeLevel;
  label: string;
}

// Admin-configurable thresholds + labels for the seller-badge ladder. Stored
// at settings/badges. Read by getSellerLevel when provided; falls back to the
// historical defaults so callers without settings still get sensible output.
export interface BadgeSettings {
  // Minimum completed sales required to qualify for each tier. Sellers below
  // `trustedMinSales` get no visible badge.
  trustedMinSales: number;
  expertMinSales: number;
  activistMinSales: number;
  labels: Record<SellerBadgeLevel, string>;
  // Per-tier feature gates. Currently only `variantsEnabled` controls whether
  // sellers at that tier can list products with per-size variants (multi-
  // variant inventory). Official defaults to true to preserve prior behavior.
  variantsEnabled: Record<SellerBadgeLevel, boolean>;
}

export const DEFAULT_BADGE_SETTINGS: BadgeSettings = {
  trustedMinSales: 0,
  expertMinSales: 5,
  activistMinSales: 10,
  labels: {
    trusted: 'Trusted Seller',
    expert: 'Expert Seller',
    activist: 'Fashion Activist',
    official: 'Official Registered Brand',
  },
  variantsEnabled: {
    trusted: false,
    expert: false,
    activist: false,
    official: true,
  },
};

// Resolve the effective settings, merging stored values onto the defaults so
// callers always receive a complete object regardless of partial saves.
export function resolveBadgeSettings(stored?: Partial<BadgeSettings> | null): BadgeSettings {
  return {
    trustedMinSales: stored?.trustedMinSales ?? DEFAULT_BADGE_SETTINGS.trustedMinSales,
    expertMinSales: stored?.expertMinSales ?? DEFAULT_BADGE_SETTINGS.expertMinSales,
    activistMinSales: stored?.activistMinSales ?? DEFAULT_BADGE_SETTINGS.activistMinSales,
    labels: { ...DEFAULT_BADGE_SETTINGS.labels, ...(stored?.labels ?? {}) },
    variantsEnabled: { ...DEFAULT_BADGE_SETTINGS.variantsEnabled, ...(stored?.variantsEnabled ?? {}) },
  };
}

export function getSellerLevel(
  user: Partial<FirestoreUser> | null | undefined,
  settings?: Partial<BadgeSettings> | null,
): SellerBadge | null {
  const s = resolveBadgeSettings(settings);

  // 1. Explicit admin override wins — bypasses thresholds entirely.
  if (user?.badgeOverride) {
    return { level: user.badgeOverride, label: s.labels[user.badgeOverride] };
  }
  // 2. Official-brand flag remains a shortcut to the top-tier badge.
  if (user?.isOfficialBrand) return { level: 'official', label: s.labels.official };
  // 3. Otherwise compute from sales count + configurable thresholds.
  const sales = typeof user?.salesCount === 'number' ? user.salesCount : 0;
  if (sales >= s.activistMinSales) return { level: 'activist', label: s.labels.activist };
  if (sales >= s.expertMinSales) return { level: 'expert', label: s.labels.expert };
  if (sales >= s.trustedMinSales) return { level: 'trusted', label: s.labels.trusted };
  // Below the Trusted threshold → no badge.
  return null;
}

// Whether this user is allowed to list products with per-size variant
// inventory. Driven by their effective badge level + the per-tier toggle in
// settings. Sellers with no badge cannot use variants.
export function canUseVariants(
  user: Partial<FirestoreUser> | null | undefined,
  settings?: Partial<BadgeSettings> | null,
): boolean {
  const s = resolveBadgeSettings(settings);
  const badge = getSellerLevel(user, settings);
  return !!badge && !!s.variantsEnabled[badge.level];
}

// --- Products ---
export type ProductStatus = "draft" | "pending_review" | "active" | "sold" | "removed" | "expired" | "reserved";

export interface ProductImage {
  url: string;
  thumbnailUrl?: string;
  position: number;
}

export interface ProductVariant {
  /** Size label exactly as it appears in the size chart (e.g. "38", "M"). */
  size: string;
  /** Remaining units in stock for this variant. */
  quantity: number;
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
  // Available inventory for this listing. Defaults to 1 (unique item) when
  // older records are missing the field. For multi-variant listings (only
  // available to Official Registered Brand sellers) this is the sum of all
  // variant quantities; checkout decrements both the matching variant and
  // this top-level field so existing readers keep working.
  quantity?: number;
  // Per-size inventory. Present only when the seller is an "Official
  // Registered Brand" and they chose to list per-size stock. When this array
  // exists and is non-empty, the public product page shows a size picker
  // with stock per size, and checkout decrements the matching variant.
  variants?: ProductVariant[];
  size?: string;
  /** Size system the `size` (and any variant sizes) belong to: e.g. "EU",
   * "US", "UK", "IT", "FR", "International". Set from the seller's size
   * chart pick in the sell wizard; used by the size-guide popover on the
   * product page and by the size facet on search. */
  sizeSystem?: string;
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
  /** URL slug, set once at publish and only changed deliberately by an admin.
   *  Regenerating it from the title would silently change a listing's live URL
   *  whenever a typo was fixed, discarding whatever ranking it had.
   *  See src/lib/product-slug.ts. */
  seoSlug?: string;
  /** Overrides the <title> and og:title on the listing page. Falls back to
   *  "{title} | {brand} | MarigoApp" when blank. */
  seoTitle?: string;
  /** Overrides the meta description. Falls back to the listing description. */
  seoDescription?: string;
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
  status:
    | "pending_payment"
    | "payment_failed"
    | "confirmed"
    | "processing" // legacy alias for confirmed
    | "in_preparation"
    | "prepared"
    | "shipped"
    | "delivered"
    | "completed"
    | "cancel_requested"
    | "refund_requested"
    | "return_initiated"
    | "cancelled"
    | "refunded";
  paymentMethod: "card" | "cod";
  // Customer-supplied reasons that admin reviews before approving.
  cancellationReason?: string;
  refundReason?: string;
  cancelRequestedBy?: string; // uid
  refundRequestedBy?: string; // uid
  paymentIntentId?: string;
  shippingAddress: AddressFormValues;
  createdAt: FirestoreTimestamp;
  couponCode?: string | null;
  discountAmount?: number;
  taxAmount?: number;
  taxRate?: number;
  /** Append-only log of status transitions for buyer/seller history view. */
  statusHistory?: Array<{ status: string; at: string; by?: string }>;
  /** Set when the seller has filed a cancellation request (pending admin review). */
  sellerCancelRequested?: boolean;
  sellerCancelReason?: string;
  // --- Shopify-style cross-references (Phase A) ---
  // IDs of related child records living in their own collections. Lets the
  // order page render "see related dispute / return / refund" links without
  // querying every collection.
  disputeIds?: string[];
  returnIds?: string[];
  refundIds?: string[];
  // Running total of all refunds applied to this order (positive number).
  // When equals totalAmount → fully refunded; between 0 and totalAmount →
  // partially refunded.
  refundedAmount?: number;
}

// Append-only finance ledger. Every money movement (sale, refund, partial
// refund, cancellation reversal, payout) gets one row here so /admin/finance
// can render an immutable history without recomputing from orders.
export interface FirestoreTransaction {
  id: string;
  // 'sale' is the original capture; refund/cancellation are reversals and
  // carry a negative `amount`.
  type: 'sale' | 'refund' | 'partial_refund' | 'cancellation' | 'payout';
  orderId: string;
  orderNumber: string;
  // Optional child references that triggered this transaction.
  refundId?: string;
  returnId?: string;
  disputeId?: string;
  // Buyer for sales; seller for payouts. Kept generic so the row stays useful
  // regardless of direction.
  userId: string;
  // Positive for inflows (sale, payout) and negative for outflows (refund,
  // cancellation), expressed in the order's currency. The finance page sums
  // them directly without sign juggling.
  amount: number;
  commission: number;
  sellerPayout: number;
  paymentMethod?: 'card' | 'cod' | 'stripe' | string;
  note?: string;
  createdAt: FirestoreTimestamp;
  createdBy?: string;
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
  yearOfPurchase: z.string().optional(),
  serialNumber: z.string().optional(),
  packaging: z.array(z.string()).optional(),
});

export const sellStep4Schema = z.object({
  condition: z.string().min(1, "Condition is required"),
  material: z.string().min(1, "Material is required"),
  color: z.string().min(1, "Color is required"),
  sizeValue: z.string().optional(),
  sizeSystem: z.string().optional(),
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
  sizeSystem?: string;
  pattern?: string;
  vintage: boolean;
  price: number;
  originalPrice?: number;
  quantity: number;
  variants?: ProductVariant[];
  listingType: "fixed_price" | "auction";
  allowOffers: boolean;
  // No `shippingMethod` — delivery is a flat platform fee (DEFAULT_SHIPPING_FEE_ALL),
  // not a per-listing courier choice.
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
  order?: number;
  // Whether this top-level category is shown in the homepage "Shop by Category"
  // tabs. Undefined or true → visible; false → hidden. Only meaningful on parents.
  homepageVisible?: boolean;
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
  /** Platform commission, expressed as a fraction (0.15 == 15%). Default 0.15. */
  commissionRate?: number;
  taxEnabled?: boolean;
  taxRate?: number;
  taxLabel?: string;
  relatedProducts?: RelatedProductsConfig;
  /** Hours to hold escrow after delivery before auto-capturing + paying out
   *  the seller. Default 72. The hourly `releaseEscrow` job reads this. */
  payoutHoldHours?: number;
  /** Days after delivery during which a buyer can still request a refund.
   *  After this window the order is locked. Default 14. */
  refundWindowDays?: number;
  /** When true, sellers without a connected Stripe account are paid via a
   *  manual bank transfer (admin handles offline). When false, only Stripe
   *  Connect-onboarded sellers can sell. Default false. */
  allowOfflineSellers?: boolean;
}

export const DEFAULT_PAYOUT_HOLD_HOURS = 72;
export const DEFAULT_REFUND_WINDOW_DAYS = 14;
export const DEFAULT_COMMISSION_RATE = 0.15;

/**
 * Flat delivery fee charged on an order.
 *
 * The business figure is a round **200 ALL** — Albania is the primary market
 * and `DEFAULT_CURRENCY` is ALL. It is stored in EUR because every persisted
 * money value in the app is (Stripe amounts, payouts, the finance dashboards),
 * and `formatPrice()` converts for display.
 *
 * `ALL_PER_EUR` mirrors the fallback table in `CurrencyContext` — which is the
 * rate the app actually runs on today, since `config/exchangeRates` does not
 * exist in Firestore. Dividing here rather than hardcoding 1.93 keeps the
 * displayed figure exactly 200 ALL, and makes the intent legible if the rate
 * ever moves. If a real `config/exchangeRates` doc is added with a different
 * ALL rate, the *displayed* fee drifts off 200 — update this pair together.
 *
 * Replaces the two separate hardcoded `10.9` literals that used to live in
 * CartContext and the create-order route, which could silently disagree.
 */
export const DEFAULT_SHIPPING_FEE_ALL = 200;
const ALL_PER_EUR = 103.5;
export const DEFAULT_SHIPPING_FEE_EUR = DEFAULT_SHIPPING_FEE_ALL / ALL_PER_EUR;

export interface RelatedProductsConfig {
  enabled: boolean;
  /** How many products to show in the rail. */
  count: number;
  /** Primary similarity field used to find related items. */
  matchBy: 'subcategory' | 'brand' | 'gender';
  /** Whether to additionally restrict to the same gender. */
  sameGender: boolean;
  /** Sort order applied client-side after the Firestore query. */
  sortBy: 'newest' | 'priceAsc' | 'priceDesc';
}

export const DEFAULT_RELATED_PRODUCTS_CONFIG: RelatedProductsConfig = {
  enabled: true,
  count: 8,
  matchBy: 'subcategory',
  sameGender: true,
  sortBy: 'newest',
};

// --- Messaging ---
export interface FirestoreConversation {
  id: string;
  participants: string[];
  participantDetails: Array<{ userId: string; name: string; avatar?: string; role?: string }>;
  productId: string;
  productTitle: string;
  productImage: string;
  lastMessage: string;
  lastMessageAt: FirestoreTimestamp;
  unreadCount: Record<string, number>;
  /** Where the conversation originated. 'dispute' = admin support thread. */
  source?: 'dispute' | string;
  /** Set when the linked dispute is closed/resolved so the thread becomes read-only. */
  caseClosed?: boolean;
  caseStatus?: 'open' | 'investigating' | 'resolved' | 'closed';
  disputeId?: string;
  /** Mirrors `dispute.source` so the chat header can show what the case
   *  is about (refund request, cancellation request, …) without an
   *  extra Firestore read. */
  disputeKind?: string;
}

/** Human label for a dispute's `source` tag. Used on chat headers and on
 *  the admin disputes board so all three audiences see the same wording. */
export function disputeKindLabel(source?: string): string {
  switch (source) {
    case 'buyer_cancel_request':
      return 'Cancellation request';
    case 'seller_cancel_request':
      return 'Cancellation request (seller)';
    case 'buyer_refund_request':
      return 'Refund request';
    default:
      return 'Dispute';
  }
}

export interface FirestoreMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: FirestoreTimestamp;
  read: boolean;
  /** Author role — used to style admin/dispute messages distinctly. */
  senderRole?: 'buyer' | 'seller' | 'admin' | 'system';
  senderName?: string;
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
  /** Alias for `amount` (buyer's offer amount). */
  offerAmount?: number;
  /** Seller's counter amount when status === 'countered'. */
  counterOfferAmount?: number;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'countered' | 'withdrawn' | 'declined';
  createdAt: FirestoreTimestamp;
  /** Append-only history of actions on this offer. */
  history?: Array<{
    action: string;
    amount?: number;
    by_user: string;
    timestamp: FirestoreTimestamp;
  }>;
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
  // Cross-references (Phase A). At least one of disputeId/returnId is set when
  // the refund was triggered by the lifecycle helpers.
  disputeId?: string;
  returnId?: string;
  // 'full' vs 'partial' vs 'cancellation' (no item ever shipped).
  type?: 'full' | 'partial' | 'cancellation';
  // Mirror of the transaction row this refund created in the ledger.
  transactionId?: string;
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
  /** Tags how the dispute was opened, e.g. "seller_cancel_request". */
  source?: string;
  cancellationFee?: number;
  // Shopify-style type tag for what the dispute is asking for. Drives the
  // lifecycle helper that fires on resolve (cancellation / return / refund).
  // Derived from `source` when missing.
  disputeType?: 'cancellation' | 'return_request' | 'refund_request';
  // Cross-references back to the child records spawned by resolving this
  // dispute.
  refundId?: string;
  returnId?: string;
  /** Denormalized product info so admin views and chat threads can show
   *  the item name/image without fetching the order. */
  productId?: string;
  productTitle?: string;
  productImage?: string;
}

// --- Returns ---
export const ReturnStatusEnum = {
  REQUESTED: 'requested',
  APPROVED: 'approved',
  READY_FOR_PICKUP: 'ready_for_pickup',
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
  status: 'requested' | 'approved' | 'ready_for_pickup' | 'shipping' | 'received' | 'refunded' | 'exchanged' | 'rejected';
  adminNotes?: string;
  processedBy?: string;
  createdAt: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
  // Cross-references (Phase A).
  disputeId?: string;
  refundId?: string;
  // Shipping label tracking for the reverse shipment.
  trackingNumber?: string;
  shippingLabelUrl?: string;
}
