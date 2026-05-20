'use client';
import { 
  Firestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  doc, 
  setDoc, 
  serverTimestamp, 
  Query, 
  DocumentData,
  updateDoc
} from 'firebase/firestore';
import type { FirestoreProduct, ProductStatus } from '@/lib/types';

/**
 * Service Layer for Product Operations
 * Centralizes all Firestore logic for product management.
 */
export class ProductService {
  private static collectionName = 'products';

  /**
   * Returns a query for active products, ordered by listing date.
   */
  static getActiveProductsQuery(db: Firestore, limitCount = 50): Query<DocumentData> {
    return query(
      collection(db, this.collectionName),
      where('status', '==', 'active'),
      orderBy('listingCreated', 'desc'),
      limit(limitCount)
    );
  }

  /**
   * Returns a query for products pending moderation.
   */
  static getPendingReviewQuery(db: Firestore): Query<DocumentData> {
    return query(
      collection(db, this.collectionName),
      where('status', '==', 'pending_review'),
      orderBy('listingCreated', 'desc')
    );
  }

  /**
   * Returns a query for all products (Admin view).
   */
  static getAllProductsQuery(db: Firestore): Query<DocumentData> {
    return query(
      collection(db, this.collectionName),
      orderBy('listingCreated', 'desc')
    );
  }

  /**
   * Returns a query for a seller's listings.
   */
  static getSellerListingsQuery(db: Firestore, sellerId: string): Query<DocumentData> {
    return query(
      collection(db, this.collectionName),
      where('sellerId', '==', sellerId),
      orderBy('listingCreated', 'desc')
    );
  }

  /**
   * Publishes a new product to Firestore.
   * Ensures data consistency and server-side timestamps.
   */
  static async publishProduct(db: Firestore, productData: Partial<FirestoreProduct>): Promise<void> {
    if (!productData.id) throw new Error("Product ID is required for publishing.");
    
    const productRef = doc(db, this.collectionName, productData.id);
    const now = serverTimestamp();
    
    const finalData: Record<string, any> = {
      ...productData,
      createdAt: now,
      updatedAt: now,
      listingCreated: now, // Important for feed ordering
      views: 0,
      wishlistCount: 0,
      isFeatured: false,
      isAuthenticated: false,
      status: productData.status || 'active',
    };

    // Firestore rejects `undefined` anywhere in the payload (top-level *or*
    // nested inside arrays/objects). Strip recursively so callers can use
    // `field: condition ? value : undefined` freely.
    const stripUndefined = (v: any): any => {
      if (Array.isArray(v)) return v.map(stripUndefined).filter(x => x !== undefined);
      if (v && typeof v === 'object' && v.constructor === Object) {
        const out: Record<string, any> = {};
        for (const [k, val] of Object.entries(v)) {
          const cleaned = stripUndefined(val);
          if (cleaned !== undefined) out[k] = cleaned;
        }
        return out;
      }
      return v;
    };
    const sanitized = stripUndefined(finalData);

    try {
        await setDoc(productRef, sanitized, { merge: true });
    } catch (error: any) {
        console.error("ProductService Error:", error);
        throw new Error(error.message || "Failed to finalize the listing document.");
    }
  }

  /**
   * Updates an existing product's status (e.g., Sold, Removed).
   */
  static async updateStatus(db: Firestore, productId: string, status: ProductStatus): Promise<void> {
    const productRef = doc(db, this.collectionName, productId);
    await updateDoc(productRef, { 
      status, 
      updatedAt: serverTimestamp() 
    });
  }
}
