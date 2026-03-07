
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
  CollectionReference
} from 'firebase/firestore';
import type { FirestoreProduct, ProductStatus } from '@/lib/types';

/**
 * Service Layer for Product Operations
 * This abstracts Firestore details from the components.
 */
export class ProductService {
  private static collectionName = 'products';

  /**
   * Returns a query for active products, ordered by creation date.
   * NOTE: This requires a composite index in Firestore: 
   * Field: status (Ascending), Field: listingCreated (Descending)
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
   */
  static async publishProduct(db: Firestore, productData: Partial<FirestoreProduct>): Promise<void> {
    if (!productData.id) throw new Error("Product ID is required for publishing.");
    
    const productRef = doc(db, this.collectionName, productData.id);
    const finalData = {
      ...productData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      listingCreated: serverTimestamp(),
      views: 0,
      wishlistCount: 0,
      isFeatured: false,
      isAuthenticated: false,
    };

    await setDoc(productRef, finalData);
  }

  /**
   * Updates an existing product's status.
   */
  static async updateStatus(db: Firestore, productId: string, status: ProductStatus): Promise<void> {
    const productRef = doc(db, this.collectionName, productId);
    await setDoc(productRef, { status, updatedAt: serverTimestamp() }, { merge: true });
  }
}
