# Deployment Guide

## Frontend Deployment

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

3. **Configure Environment Variables** (if needed)
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Add any required Firebase configuration

### Option 2: Netlify

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Build and Deploy**
   ```bash
   npm run build
   netlify deploy --prod
   ```

### Option 3: Firebase Hosting

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Initialize Firebase Hosting**
   ```bash
   firebase init hosting
   ```

3. **Build and Deploy**
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

## Firebase Backend Deployment

### 1. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 2. Deploy Firestore Indexes

```bash
firebase deploy --only firestore:indexes
```

### 3. Enable Required Services

- **Authentication**: Enable Email/Password in Firebase Console
- **Firestore**: Create database in production mode
- **Realtime Database** (optional): For ESP32 device sync

## ESP32 Firmware Deployment

1. **Configure WiFi and Firebase** in `SeniorPill_ESP32.ino`
2. **Upload to ESP32** using Arduino IDE
3. **Monitor Serial Output** to verify connection

## Post-Deployment Checklist

- [ ] Firebase Authentication enabled
- [ ] Firestore security rules deployed
- [ ] Firestore indexes created
- [ ] Frontend deployed and accessible
- [ ] ESP32 device connected and syncing
- [ ] Test user accounts created
- [ ] Role-based access verified
- [ ] Real-time updates working
- [ ] Offline mode tested

## Environment Configuration

### Production Environment Variables

If using environment variables, create `.env.production`:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

Update `src/firebase/config.js` to use environment variables:

```javascript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // ... etc
};
```

