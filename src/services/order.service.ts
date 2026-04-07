
'use client';
import {
  Firestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Query,
  DocumentData,
} from 'firebase/firestore';
import type { FirestoreOrder } from '@/lib/types';

export class OrderService {
  private static collectionName = 'orders';

  // ── Queries ──

  static getBuyerOrdersQuery(db: Firestore, buyerId: string): Query<DocumentData> {
    return query(
      collection(db, this.collectionName),
      where('buyerId', '==', buyerId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  }

  static getSellerOrdersQuery(db: Firestore, sellerId: string): Query<DocumentData> {
    return query(
      collection(db, this.collectionName),
      where('sellerIds', 'array-contains', sellerId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  }

  static getRecentOrdersQuery(db: Firestore, limitCount = 100): Query<DocumentData> {
    return query(
      collection(db, this.collectionName),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
  }

  // ── CRUD ──

  static async getById(db: Firestore, orderId: string): Promise<FirestoreOrder | null> {
    const snap = await getDoc(doc(db, this.collectionName, orderId));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as FirestoreOrder) : null;
  }

  static async updateStatus(
    db: Firestore,
    orderId: string,
    status: FirestoreOrder['status']
  ): Promise<void> {
    await updateDoc(doc(db, this.collectionName, orderId), {
      status,
      updatedAt: serverTimestamp(),
    });
  }
}
