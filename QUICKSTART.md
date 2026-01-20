# Quick Start Guide

Get your SeniorPill system up and running in 5 steps!

## Step 1: Firebase Setup (5 minutes)

1. **Go to [Firebase Console](https://console.firebase.google.com/)**
2. **Create a new project** (or use existing: `pill-7577b`)
3. **Enable Authentication**
   - Go to Authentication → Sign-in method
   - Enable Email/Password provider
4. **Create Firestore Database**
   - Go to Firestore Database
   - Click "Create database"
   - Start in production mode
   - Choose your region
5. **Deploy Security Rules**
   - Copy `firestore.rules` content
   - Go to Firestore → Rules
   - Paste and publish

## Step 2: Frontend Setup (3 minutes)

1. **Install dependencies**
   ```bash
   cd Seniorpill
   npm install
   ```

2. **Firebase config is already set** in `src/firebase/config.js`

3. **Run the app**
   ```bash
   npm run dev
   ```

4. **Open browser**: `http://localhost:3000`

## Step 3: Create Test Accounts (2 minutes)

1. **Register as Caregiver**
   - Click "Don't have an account? Register"
   - Select "Caregiver"
   - Enter email and password
   - Click "Create Account"

2. **Register as Patient**
   - Logout
   - Register again with "Patient" role
   - Note the Patient UID (you'll need this for ESP32)

## Step 4: Configure Patient Settings (2 minutes)

1. **Login as Caregiver**
2. **Enter Patient ID** (the UID from Step 3)
3. **Click "Load Patient"**
4. **Click "Edit Settings"**
5. **Set:**
   - Morning dose time (e.g., 09:00)
   - Evening dose time (e.g., 21:00)
   - Initial pill count (e.g., 30)
6. **Click "Save Settings"**

## Step 5: ESP32 Setup (10 minutes)

1. **Install Arduino IDE** and ESP32 board support
2. **Install Libraries:**
   - Firebase ESP32 Client (by Mobizt)
   - ArduinoJson (by Benoit Blanchon)

3. **Open** `firmware/SeniorPill_ESP32.ino`

4. **Update Configuration:**
   ```cpp
   #define WIFI_SSID "YourWiFiName"
   #define WIFI_PASSWORD "YourWiFiPassword"
   #define FIREBASE_HOST "pill-7577b-default-rtdb.firebaseio.com"
   #define FIREBASE_AUTH "your-database-secret"
   #define PATIENT_ID "patient-uid-from-step-3"
   ```

5. **Get Firebase Database Secret:**
   - Firebase Console → Project Settings → Service Accounts
   - Click "Database secrets" tab
   - Copy the secret

6. **Upload to ESP32**
   - Select board: ESP32 Dev Module
   - Select port
   - Click Upload

7. **Open Serial Monitor** (115200 baud) to verify connection

## Testing the System

### Test Patient Dashboard
1. Login as Patient
2. View dose history (empty initially)
3. Check device status

### Test Caregiver Dashboard
1. Login as Caregiver
2. Load patient
3. View alerts and statistics
4. Update settings

### Test ESP32 Device
1. Wait for scheduled reminder time
2. Buzzer and LED should activate
3. Block IR sensor to simulate pill removal
4. Check dashboard for "taken" log

## Common Issues

**"Authentication failed"**
- Check Firebase Authentication is enabled
- Verify email/password format

**"Failed to load patient data"**
- Ensure patient ID is correct
- Check Firestore security rules are deployed

**ESP32 not connecting**
- Verify WiFi credentials
- Check Firebase host and auth token
- Review Serial Monitor output

## Next Steps

- Customize dose times
- Add more patients (for caregivers)
- Review analytics and adherence reports
- Set up alerts for missed doses

## Need Help?

- Check [README.md](./README.md) for detailed documentation
- Review [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup
- See [firmware/README_FIRMWARE.md](./firmware/README_FIRMWARE.md) for hardware details

---

**Note**: For production use, ensure proper security measures, compliance with healthcare regulations, and thorough testing.

