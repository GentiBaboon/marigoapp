
'use client';
import { 
  Firestore, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  collection,
  query,
  limit,
  Query,
  DocumentData
} from 'firebase/firestore';
import type { FirestoreUser } from '@/lib/types';

export class UserService {
  private static collectionName = 'users';

  /**
   * Fetches a user profile.
   */
  static async getProfile(db: Firestore, userId: string): Promise<FirestoreUser | null> {
    const userRef = doc(db, this.collectionName, userId);
    const snap = await getDoc(userRef);
    return snap.exists() ? (snap.data() as FirestoreUser) : null;
  }

  /**
   * Ensures a user document exists in Firestore (Sync with Auth).
   */
  static async syncAuthUser(db: Firestore, user: any): Promise<void> {
    const userRef = doc(db, this.collectionName, user.uid);
    await setDoc(userRef, {
      name: user.displayName,
      email: user.email,
      profileImage: user.photoURL,
      lastLoginAt: serverTimestamp(),
    }, { merge: true });
  }

  /**
   * Admin: Get all users.
   */
  static getAllUsersQuery(db: Firestore): Query<DocumentData> {
    return query(
      collection(db, this.collectionName),
      limit(100)
    );
  }
}
