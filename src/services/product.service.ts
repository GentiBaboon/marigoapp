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
   * Uses serverTimestamp for reliability.
   */
  static async publishProduct(db: Firestore, productData: Partial<FirestoreProduct>): Promise<void> {
    if (!productData.id) throw new Error("Product ID is required for publishing.");
    
    const productRef = doc(db, this.collectionName, productData.id);
    const now = serverTimestamp();
    
    const finalData = {
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

    // Attempt atomic write
    try {
        await setDoc(productRef, finalData);
    } catch (error: any) {
        console.error("Firestore Publish Error:", error);
        throw new Error(error.message || "Failed to create product listing in database.");
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
