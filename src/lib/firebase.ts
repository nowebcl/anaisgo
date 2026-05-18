import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Verify if the core Firebase environment variables are loaded
export const isFirebaseConfigured = !!(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
);

// Fallback mock configuration for build stability
const mockConfig = {
  apiKey: 'mock-api-key-anais-agendamiento',
  authDomain: 'anais-agendamiento-mock.firebaseapp.com',
  projectId: 'anais-agendamiento-mock',
  storageBucket: 'anais-agendamiento-mock.appspot.com',
  messagingSenderId: '0000000000',
  appId: '1:0000000000:web:00000000000000000000'
};

const app = getApps().length > 0 
  ? getApp() 
  : initializeApp(isFirebaseConfigured ? firebaseConfig : mockConfig);

const db = getFirestore(app);

export { db };
export default db;
