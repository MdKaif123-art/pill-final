// Firebase Configuration and Initialization
// SeniorPill - Smart Medication Management System

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBwDWBlbqBi2rfrjOXhvab55u73dO0LVGI",
  authDomain: "pill-81bf4.firebaseapp.com",
  projectId: "pill-81bf4",
  storageBucket: "pill-81bf4.firebasestorage.app",
  messagingSenderId: "38541040110",
  appId: "1:38541040110:web:887ebab766813eaba8d6ff"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Firebase Cloud Messaging (FCM) - only in browser
let messaging = null;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.warn('FCM initialization failed:', error);
  }
}
export { messaging };

export default app;

