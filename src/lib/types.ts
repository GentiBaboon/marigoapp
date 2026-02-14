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

export const firestoreUserSchema = z.object({
  id: z.string(),
  displayName: z.string().optional().nullable(),
  email: z.string().email().optional(),
  macroCategoryPreference: z.enum(["womenswear", "menswear"]).optional(),
  hasAcceptedChatRules: z.boolean().optional(),
  isSeller: z.boolean().optional(),
  createdAt: z.any().optional(),
});
export type FirestoreUser = z.infer<typeof firestoreUserSchema>;


// --- Checkout & Address Schemas ---

export const addressSchema = z.object({
  fullName: z.string().min(2, "Full name is required."),
  phone: z.string().min(6, "A valid phone number is required."),
  address: z.string().min(5, "Street address is required."),
  city: z.string().min(2, "City is required."),
  postal: z.string().min(3, "Postal code is required."),
  country: z.string().min(2, "Country is required."),
});

export type AddressFormValues = z.infer<typeof addressSchema>;

export type FirestoreAddress = AddressFormValues & {
  id: string;
  isDefault: boolean;
};

// --- Sell Schemas ---
export const imageFileSchema = z.object({
  preview: z.string(), // This will be a data URL
  name: z.string(),
  type: z.string(),
});
export type ImageFile = z.infer<typeof imageFileSchema>;

export const proofFileSchema = z.object({
  preview: z.string(), // data URL or object URL for PDFs
  name: z.string(),
  type: z.string(),
});
export type ProofFile = z.infer<typeof proofFileSchema>;


export const sellStep1Schema = z.object({
  gender: z.enum(['womenswear', 'menswear', 'girlswear', 'boyswear'], { required_error: 'Please select a type.' }),
  category: z.string().min(1, 'Please select a category.'),
  brand: z.string().min(1, 'Brand is required.'),
});

export const sellStep2Schema = z.object({
  condition: z.enum(['new', 'like_new', 'good', 'fair'], { required_error: 'Please select a condition.' }),
  sizeStandard: z.string().optional(),
  sizeValue: z.string().optional(),
  material: z.string().min(1, 'Material is required.'),
  color: z.string().min(1, 'Color is required.'),
  pattern: z.string().optional(),
  vintage: z.boolean().default(false),
  proofOfOrigin: z.array(proofFileSchema).optional(),
});

export const sellStep3Schema = z.object({
  images: z.array(imageFileSchema).min(3, 'At least three images are required.').max(15, 'You can upload a maximum of 15 images.'),
});

export const sellStep4Schema = z.object({
    title: z.string().min(10, 'Title must be at least 10 characters.').max(70, 'Title must be 70 characters or less.'),
    description: z.string().min(20, 'Description must be at least 20 characters.').max(500, 'Description cannot exceed 500 characters.'),
    origin: z.enum(['direct', 'private', 'vestiaire', 'other']).optional(),
    yearOfPurchase: z.string().optional(),
    serialNumber: z.string().optional(),
    packaging: z.array(z.string()).optional(),
});

export const sellStep5Schema = z.object({
    price: z.preprocess(
        (a) => {
            if (typeof a === 'string' && a.trim() !== '') return parseFloat(a);
            if (typeof a === 'number') return a;
            return undefined;
        },
        z.number({required_error: "Price is required.", invalid_type_error: "Price must be a number."}).min(1, "Price must be at least 1.")
    ),
    currency: z.enum(['EUR', 'ALL'], { required_error: 'A currency is required.' }),
});

export const sellFormSchema = sellStep1Schema.merge(sellStep2Schema).merge(sellStep3Schema).merge(sellStep4Schema).merge(sellStep5Schema);

export type SellFormValues = z.infer<typeof sellFormSchema> & { sellerEarning?: number };

export interface SellDraft {
  id: string;
  formData: Partial<SellFormValues>;
  currentStep: number;
  lastModified: number;
}


// --- Product & Cart Schemas ---

export const firestoreProductSchema = z.object({
  sellerId: z.string(),
  title: z.string(),
  description: z.string(),
  price: z.number(),
  category: z.string(),
  subCategory: z.string(),
  images: z.array(z.string()),
  status: z.enum(["active", "sold", "reserved"]),
  createdAt: z.any(),
});

export type FirestoreProduct = z.infer<typeof firestoreProductSchema> & { id: string };

const offerHistoryItemSchema = z.object({
  action: z.string(),
  amount: z.number(),
  by_user: z.string(),
  timestamp: z.any(),
});

export const firestoreOfferSchema = z.object({
  buyerId: z.string(),
  sellerId: z.string(),
  amount: z.number(),
  status: z.enum(['pending', 'accepted', 'declined', 'countered', 'expired', 'withdrawn']),
  counterAmount: z.number().optional(),
  createdAt: z.any(),
  history: z.array(offerHistoryItemSchema).optional(),
});
export type FirestoreOffer = z.infer<typeof firestoreOfferSchema> & { id: string };


// --- Order Schemas ---
const orderItemSchema = z.object({
  productId: z.string(),
  sellerId: z.string(),
  title: z.string(),
  brand: z.string(),
  image: z.string(),
  price: z.number(),
  quantity: z.number(),
  size: z.string().optional().nullable(),
  shippingMethod: z.string(),
  shippingFee: z.number(),
  authenticationFee: z.number(),
});

export const firestoreOrderSchema = z.object({
  orderNumber: z.string(),
  buyerId: z.string(),
  sellerIds: z.array(z.string()),
  items: z.array(orderItemSchema),
  itemsPrice: z.number(),
  shippingPrice: z.number(),
  authenticationPrice: z.number(),
  totalAmount: z.number(),
  paymentStatus: z.string(),
  paymentMethod: z.string(),
  paymentIntentId: z.string().optional().nullable(),
  status: z.string(),
  shippingAddress: addressSchema,
  trackingNumber: z.string().optional().nullable(),
  courierCompany: z.string().optional().nullable(),
  deliveredAt: z.any().optional().nullable(),
  createdAt: z.any(),
});

export type FirestoreOrder = z.infer<typeof firestoreOrderSchema> & { id: string };


// --- Messaging Schemas ---
export const firestoreMessageSchema = z.object({
  senderId: z.string(),
  content: z.string(),
  createdAt: z.any(),
  type: z.enum(["text", "image"]).default("text"),
  imageUrl: z.string().optional(),
  read: z.boolean().default(false),
});
export type FirestoreMessage = z.infer<typeof firestoreMessageSchema> & { id: string };


export const firestoreConversationSchema = z.object({
  participants: z.array(z.string()),
  participantDetails: z.array(z.object({
    userId: z.string(),
    name: z.string(),
    avatar: z.string().optional(),
  })),
  productId: z.string(),
  productTitle: z.string(),
  productImage: z.string(),
  lastMessage: z.string().optional(),
  lastMessageAt: z.any(),
  unreadCount: z.record(z.string(), z.number()).default({}), // E.g. { userId1: 2, userId2: 0 }
});
export type FirestoreConversation = z.infer<typeof firestoreConversationSchema> & { id: string };

// --- Review Schema ---
export const firestoreReviewSchema = z.object({
  orderId: z.string(),
  productId: z.string(),
  reviewerId: z.string(), // The one writing the review (buyer)
  revieweeId: z.string(), // The one being reviewed (seller)
  rating: z.number().min(1).max(5),
  title: z.string().optional(),
  content: z.string().min(10, "Review must be at least 10 characters long."),
  createdAt: z.any(),
});
export type FirestoreReview = z.infer<typeof firestoreReviewSchema> & { id: string };

// --- Notification Schema ---
export const firestoreNotificationSchema = z.object({
  userId: z.string(),
  type: z.enum(['offer_received', 'item_sold', 'new_message', 'order_update', 'review_received', 'welcome', 'listing_suggestion', 'price_drop_suggestion', 'item_liked', 'order_reminder']),
  title: z.string(),
  message: z.string(),
  data: z.object({
    link: z.string().optional(),
    imageUrl: z.string().optional(),
  }).optional(),
  read: z.boolean().default(false),
  createdAt: z.any(),
});
export type FirestoreNotification = z.infer<typeof firestoreNotificationSchema> & { id: string };

    
