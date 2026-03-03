/**
 * Firebase (Firestore) for live tournament entries and votes.
 * Optional: if env vars are not set, tournament API falls back to in-memory mock.
 *
 * Env: EXPO_PUBLIC_FIREBASE_API_KEY, EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
 *      EXPO_PUBLIC_FIREBASE_PROJECT_ID, EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
 *      EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, EXPO_PUBLIC_FIREBASE_APP_ID
 */

import { initializeApp, getApps, type FirebaseApp } from '@firebase/app';
import { getFirestore, type Firestore } from '@firebase/firestore';

const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

export function isFirestoreEnabled(): boolean {
  return !!(apiKey && projectId);
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirestoreEnabled()) return null;
  if (app) return app;
  const apps = getApps();
  if (apps.length > 0) {
    app = apps[0] as FirebaseApp;
    return app;
  }
  app = initializeApp({
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || undefined,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || undefined,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || undefined,
  });
  return app;
}

export function getFirestoreDb(): Firestore | null {
  if (!isFirestoreEnabled()) return null;
  if (db) return db;
  const a = getFirebaseApp();
  if (!a) return null;
  db = getFirestore(a);
  return db;
}
