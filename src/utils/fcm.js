// Firebase Cloud Messaging (FCM) Utilities
// Handles FCM token registration and background notifications

import { messaging } from '../firebase/config';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// VAPID key - Generate this in Firebase Console:
// 1. Go to Firebase Console → Project Settings → Cloud Messaging
// 2. Under "Web Push certificates", click "Generate key pair"
// 3. Copy the key and paste it here
// For now, this will work with service worker messaging (no VAPID key needed for basic notifications)
const VAPID_KEY = null; // Set this after generating in Firebase Console

/**
 * Request FCM token and register it
 */
export const requestFCMToken = async (userId) => {
  if (!messaging) {
    console.warn('FCM messaging not available');
    return null;
  }

  try {
    // Request notification permission first
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    // Get FCM token (VAPID key is optional for service worker notifications)
    const tokenOptions = VAPID_KEY ? { vapidKey: VAPID_KEY } : {};
    const token = await getToken(messaging, tokenOptions);

    if (token) {
      console.log('FCM Token:', token);
      
      // Store token in Firestore for this user
      if (userId) {
        try {
          await setDoc(doc(db, 'fcmTokens', userId), {
            token: token,
            userId: userId,
            createdAt: new Date(),
            updatedAt: new Date()
          }, { merge: true });
          console.log('FCM token saved to Firestore');
        } catch (error) {
          console.error('Error saving FCM token:', error);
        }
      }
      
      return token;
    } else {
      console.warn('No FCM token available');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

/**
 * Listen for foreground messages (when app is open)
 */
export const setupForegroundMessageListener = (callback) => {
  if (!messaging) {
    console.warn('FCM messaging not available');
    return null;
  }

  try {
    return onMessage(messaging, (payload) => {
      console.log('Foreground FCM message received:', payload);
      if (callback) {
        callback(payload);
      }
      
      // Show notification even in foreground
      if (payload.notification) {
        new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: payload.notification.icon || '/vite.svg',
          badge: '/vite.svg',
          tag: payload.data?.tag || 'seniorpill-reminder',
          requireInteraction: payload.data?.requireInteraction || false
        });
      }
    });
  } catch (error) {
    console.error('Error setting up FCM listener:', error);
    return null;
  }
};

/**
 * Check if FCM is supported
 */
export const isFCMSupported = () => {
  return messaging !== null && 'serviceWorker' in navigator;
};

