
'use client';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  limit,
  Query,
  DocumentData,
} from 'firebase/firestore';
import type { FirestoreUser } from '@/lib/types';

export class UserService {
  private static collectionName = 'users';

  // ── Queries ──

  static getAllUsersQuery(db: Firestore): Query<DocumentData> {
    return query(collection(db, this.collectionName), limit(100));
  }

  static getAdminUsersQuery(db: Firestore): Query<DocumentData> {
    return query(collection(db, this.collectionName), where('role', '==', 'admin'));
  }

  // ── CRUD ──

  static async getProfile(db: Firestore, userId: string): Promise<FirestoreUser | null> {
    const snap = await getDoc(doc(db, this.collectionName, userId));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as FirestoreUser) : null;
  }

  static async syncAuthUser(db: Firestore, user: any): Promise<void> {
    await setDoc(doc(db, this.collectionName, user.uid), {
      name: user.displayName,
      email: user.email,
      profileImage: user.photoURL,
      lastLoginAt: serverTimestamp(),
    }, { merge: true });
  }

  static async updateRole(db: Firestore, userId: string, role: FirestoreUser['role']): Promise<void> {
    await updateDoc(doc(db, this.collectionName, userId), { role });
  }

  static async updateStatus(db: Firestore, userId: string, status: FirestoreUser['status']): Promise<void> {
    await updateDoc(doc(db, this.collectionName, userId), { status });
  }
}
