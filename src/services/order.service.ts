
'use client';
import { 
  Firestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  Query, 
  DocumentData 
} from 'firebase/firestore';

export class OrderService {
  private static collectionName = 'orders';

  /**
   * Returns a query for orders where the user is the buyer.
   */
  static getBuyerOrdersQuery(db: Firestore, buyerId: string): Query<DocumentData> {
    return query(
      collection(db, this.collectionName),
      where('buyerId', '==', buyerId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  }

  /**
   * Returns a query for orders where the user is a seller.
   */
  static getSellerOrdersQuery(db: Firestore, sellerId: string): Query<DocumentData> {
    return query(
      collection(db, this.collectionName),
      where('sellerIds', 'array-contains', sellerId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  }

  /**
   * Admin: Get recent orders.
   */
  static getRecentOrdersQuery(db: Firestore, limitCount = 100): Query<DocumentData> {
    return query(
      collection(db, this.collectionName),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
  }
}
