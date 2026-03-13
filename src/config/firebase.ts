import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAj2D-kAe-fnFUj1E_ErKbExLRcwASKClI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "photo44444.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "photo44444",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "photo44444.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "196953806077",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:196953806077:web:e702d3a88616b613841a94"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
