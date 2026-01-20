# Caregiver Setup Guide

## How to Set Up a New Patient

The caregiver dashboard automatically creates patient settings when you first load a patient. No manual Firestore setup needed!

### Step 1: Get Patient ID

1. Have the patient register/login to the system
2. Their Firebase Authentication UID is their Patient ID
3. You can find this in:
   - Firebase Console → Authentication → Users
   - Or ask the patient to share their user ID

### Step 2: Load Patient in Caregiver Dashboard

1. Login as **Caregiver**
2. Enter the **Patient ID** in the input field
3. Click **"Load Patient"**

### Step 3: Automatic Settings Creation

When you load a patient for the first time:
- ✅ Settings document is **automatically created** in Firestore
- ✅ Default values are set:
  - Morning dose: 09:00
  - Evening dose: 21:00
  - Pill count: 0
  - Device status: offline
- ✅ You'll see a success message: "Patient settings initialized!"

### Step 4: Configure Settings

1. Click **"Edit Settings"** button
2. Set:
   - **Morning Dose Time** (e.g., 09:00)
   - **Evening Dose Time** (e.g., 21:00)
   - **Initial Pill Count** (e.g., 30)
3. Click **"Save Settings"**

### Step 5: Device Sync

Once settings are saved:
- ESP8266 device will automatically fetch these settings
- Device will start reminders at scheduled times
- Dashboard will show real-time updates

## What Gets Created Automatically

When you first load a patient, this Firestore document is created:

**Collection:** `settings`  
**Document ID:** `{patientId}` (e.g., "U1")

**Fields:**
```json
{
  "morningDoseTime": "09:00",
  "eveningDoseTime": "21:00",
  "pillCount": 0,
  "deviceId": "U1",
  "deviceStatus": "offline",
  "lastSync": null,
  "createdAt": "2024-01-01T00:00:00Z",
  "createdBy": "caregiver"
}
```

## Troubleshooting

### "Failed to load patient data"
- **Check:** Patient ID is correct
- **Check:** Firestore security rules allow read/write
- **Check:** You're logged in as caregiver

### Settings not updating
- **Check:** Click "Load Patient" again to refresh
- **Check:** Firestore rules allow updates
- **Check:** Browser console for errors

### Device not syncing
- **Check:** Device is online (WiFi connected)
- **Check:** Device has correct Patient ID configured
- **Check:** Firestore is enabled in Firebase Console

## Next Steps

After setting up a patient:
1. ✅ Patient can login and view their dashboard
2. ✅ Device will sync settings automatically
3. ✅ Reminders will trigger at scheduled times
4. ✅ Dose logs will appear in real-time
5. ✅ Alerts will show for missed doses and low stock

---

**Note:** You don't need to manually create Firestore documents anymore. Everything is handled automatically by the caregiver dashboard!

