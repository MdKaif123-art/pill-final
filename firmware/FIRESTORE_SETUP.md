# Firestore REST API Setup Guide

## Why Firestore REST API?

Firebase Database Secrets are deprecated. This guide shows you how to use Firestore REST API instead, which uses your existing Firebase API key (no deprecated secrets needed!).

## What You Need

1. **Firebase Project ID**: `pill-7577b` (already have this)
2. **Firebase API Key**: `AIzaSyCarrWihyTgNfJPiMdZh0_g-lxBcCPuOBw` (already in your config)
3. **Firestore Database**: Must be created and enabled

## Step 1: Enable Firestore Database

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `pill-7577b`
3. Click **Firestore Database** in the left menu
4. If not created, click **Create database**
5. Choose **Start in production mode** (we'll set rules next)
6. Select your region
7. Click **Enable**

## Step 2: Update Firestore Security Rules

1. In Firestore Database, click **Rules** tab
2. Replace with these rules (allows device to write):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow device to read/write settings
    match /settings/{patientId} {
      allow read, write: if true;  // For development - restrict in production
    }
    
    // Allow device to write dose logs
    match /doseLogs/{logId} {
      allow read: if true;
      allow create: if true;  // Device can create logs
      allow update, delete: if false;  // Logs are immutable
    }
  }
}
```

3. Click **Publish**

**⚠️ Note**: These rules allow public access for development. For production, implement proper authentication.

## Step 3: Update Firmware

Use the new firmware file: `SeniorPill_ESP8266_Firestore.ino`

This version:
- ✅ Uses Firestore REST API (no deprecated secrets!)
- ✅ Uses your existing Firebase API key
- ✅ Works with your existing pin configuration
- ✅ Same functionality as before

## Step 4: Configure Firmware

The firmware is already configured with:
- Project ID: `pill-7577b`
- API Key: `AIzaSyCarrWihyTgNfJPiMdZh0_g-lxBcCPuOBw`
- Patient ID: `U1` (update if needed)

Just upload and test!

## Step 5: Test Connection

1. Upload firmware to ESP8266
2. Open Serial Monitor (115200 baud)
3. Look for:
   - `WiFi Connected!`
   - `Settings loaded from Firestore`
   - Device status updates

## Troubleshooting

### "Failed to load settings: HTTP 404"
- **Solution**: Create the settings document in Firestore first
- Go to Firestore → Add document
- Collection: `settings`
- Document ID: `U1` (or your patient ID)
- Add fields:
  - `morningDoseTime` (string): `09:00`
  - `eveningDoseTime` (string): `21:00`
  - `pillCount` (number): `30`
  - `deviceStatus` (string): `offline`

### "Failed to load settings: HTTP 403"
- **Solution**: Check Firestore security rules are published
- Ensure rules allow read/write access

### "SSL/TLS connection failed"
- **Solution**: The code uses `client.setInsecure()` which skips certificate validation
- For production, add proper certificate validation

### "WiFi Connected but can't reach Firestore"
- **Solution**: Check internet connection
- Verify Firestore is enabled in Firebase Console
- Check project ID is correct

## Data Structure

### Settings Document
```
Collection: settings
Document ID: U1 (patient ID)
Fields:
  - morningDoseTime: "09:00" (string)
  - eveningDoseTime: "21:00" (string)
  - pillCount: 30 (number)
  - deviceStatus: "online" (string)
  - lastSync: timestamp
```

### Dose Logs Collection
```
Collection: doseLogs
Documents: Auto-generated IDs
Fields:
  - patientId: "U1" (string)
  - doseType: "morning" or "evening" (string)
  - status: "taken" or "missed" (string)
  - delayMinutes: 5 (number)
  - timestamp: timestamp
  - createdAt: "2024-01-01T09:05:00" (string)
```

## Advantages of Firestore REST API

1. ✅ **No deprecated secrets** - Uses standard API keys
2. ✅ **Future-proof** - Supported by Google
3. ✅ **Better security** - Can use Firebase Authentication tokens
4. ✅ **Same database** - Works with your React dashboard
5. ✅ **Real-time sync** - Dashboard gets updates immediately

## Next Steps

1. Test the firmware connection
2. Create initial settings document in Firestore
3. Verify dose logs are being created
4. Check dashboard shows device status
5. Test full workflow (reminder → detection → logging)

---

**Need Help?** Check Serial Monitor output for detailed error messages.

