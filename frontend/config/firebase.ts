import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyC_gFg0rRKySwEqrEEFyM9pbZpXM6bQw_Q",
  authDomain: "aitravel-b0b11.firebaseapp.com",
  projectId: "aitravel-b0b11",
  storageBucket: "aitravel-b0b11.firebasestorage.app",
  messagingSenderId: "647409627775",
  appId: "1:647409627775:web:0e55993237735e04bbc54a",
  measurementId: "G-FTJPRR4QSE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with persistence
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (error) {
  // If already initialized, get existing instance
  auth = getAuth(app);
}

// Initialize Firestore
const db = getFirestore(app);

export { auth, db };
export default app;