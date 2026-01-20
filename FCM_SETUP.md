# Firebase Cloud Messaging (FCM) Setup Guide

## Overview

FCM enables background notifications that work even when the website is closed. The current implementation uses a hybrid approach:

1. **Service Worker Notifications** (Works now) - Notifications via service worker messaging
2. **FCM Push Notifications** (Optional) - True push notifications from Firebase

## Current Implementation

The system currently uses **Service Worker messaging** which works for notifications even when the website is closed, without requiring FCM setup.

### How It Works

1. When a reminder is triggered, the app sends a message to the service worker
2. The service worker shows the notification even if the website is closed
3. Clicking the notification opens/reopens the website

## Optional: Full FCM Setup (For True Push Notifications)

If you want true push notifications from a backend server, follow these steps:

### Step 1: Generate VAPID Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `pill-7577b`
3. Go to **Project Settings** (gear icon) → **Cloud Messaging** tab
4. Scroll to **Web Push certificates**
5. Click **Generate key pair**
6. Copy the generated key

### Step 2: Update VAPID Key

1. Open `src/utils/fcm.js`
2. Replace `const VAPID_KEY = null;` with your generated key:
   ```javascript
   const VAPID_KEY = "your-generated-vapid-key-here";
   ```

### Step 3: Enable Cloud Messaging API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: `pill-7577b`
3. Go to **APIs & Services** → **Library**
4. Search for "Firebase Cloud Messaging API"
5. Click **Enable**

## Testing Notifications

### Test Service Worker Notifications (Current Setup)

1. Open the patient dashboard
2. Allow notifications when prompted
3. Wait for a scheduled dose time
4. You should see a notification even if you close the browser tab

### Test FCM Push Notifications (After VAPID Setup)

1. Complete FCM setup above
2. The system will automatically register FCM tokens
3. You can send test notifications from Firebase Console:
   - Go to **Cloud Messaging** → **Send test message**
   - Enter the FCM token (check browser console)
   - Send notification

## Troubleshooting

### Notifications Not Working

1. **Check browser permissions:**
   - Chrome: Settings → Privacy and security → Site settings → Notifications
   - Ensure the site has permission

2. **Check service worker:**
   - Open DevTools → Application → Service Workers
   - Ensure service worker is registered and active

3. **Check console for errors:**
   - Open DevTools → Console
   - Look for FCM or notification errors

### Service Worker Not Registering

1. Clear browser cache
2. Unregister old service workers
3. Refresh the page
4. Check `src/main.jsx` has service worker registration code

## Current Status

✅ **Service Worker Notifications**: Working (no setup needed)
⏳ **FCM Push Notifications**: Optional (requires VAPID key setup)

The current implementation works for background notifications via service worker messaging, which is sufficient for most use cases.

