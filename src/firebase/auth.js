// Firebase Authentication Utilities
// Handles user authentication and role management

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./config";

/**
 * Sign in user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} User data with role
 */
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Fetch user role from Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data();
    
    return {
      uid: user.uid,
      email: user.email,
      role: userData?.role || "patient" // Default to patient if role not set
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Register new user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} role - User role ('patient' or 'caregiver')
 * @returns {Promise<Object>} User data with role
 */
export const register = async (email, password, role = "patient") => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Create user document in Firestore with role
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      role: role,
      createdAt: new Date().toISOString()
    });
    
    return {
      uid: user.uid,
      email: user.email,
      role: role
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Sign out current user
 */
export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
};

/**
 * Get current authenticated user with role
 * @returns {Promise<Object|null>} User data with role or null
 */
export const getCurrentUser = async () => {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const userData = userDoc.data();
          resolve({
            uid: user.uid,
            email: user.email,
            role: userData?.role || "patient"
          });
        } catch (error) {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
};

