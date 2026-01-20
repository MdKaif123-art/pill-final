# Email Notifications Setup Guide

This guide explains how to set up email notifications for caregivers using Resend.

## Overview

The email notification system sends automated emails to caregivers for:
1. **Medication Reminders** - When it's time for a patient to take their medication
2. **Dose Status** - When a dose is taken or missed (with delay information)
3. **Low Stock Alerts** - When pill count drops below 10 pills

## Architecture

- **Backend Server** (`server/index.js`): Express API server that handles email sending via Resend
- **Frontend Utilities** (`src/utils/emailNotifications.js`): Functions to call the backend API
- **Database Integration**: Caregiver email is stored in `settings/{patientId}` when assigning patients

## Setup Instructions

### 1. Install Backend Dependencies

```bash
cd server
npm install
```

### 2. Configure Resend API Key

Get your Resend API key from [resend.com](https://resend.com):

1. Sign up/login to Resend
2. Go to API Keys section
3. Create a new API key
4. Copy the API key

Set it as an environment variable:

**Windows PowerShell:**
```powershell
$env:RESEND_API_KEY="re_your_api_key_here"
```

**Windows CMD:**
```cmd
set RESEND_API_KEY=re_your_api_key_here
```

**Linux/Mac:**
```bash
export RESEND_API_KEY="re_your_api_key_here"
```

Or create a `.env` file in the `server` directory:
```
RESEND_API_KEY=re_your_api_key_here
```

### 3. Start the Backend Server

```bash
cd server
npm start
```

The server will run on `http://localhost:3001` by default.

For development with auto-reload:
```bash
npm run dev
```

### 4. Configure Frontend API URL

In your frontend `.env` file (or `vite.config.js`), set:
```
VITE_API_URL=http://localhost:3001
```

Or update `src/utils/emailNotifications.js`:
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
```

### 5. Update Resend "From" Address

In `server/index.js`, update the `from` field in the `sendEmail` function:

```javascript
from: 'SeniorPill <onboarding@resend.dev>', // Change to your verified domain
```

**Important**: You need to verify your domain in Resend or use the default `onboarding@resend.dev` for testing.

## How It Works

### 1. Caregiver Assigns Patient

When a caregiver creates a new patient and assigns a custom UID:
- The caregiver's email is automatically stored in `settings/{patientId}.caregiverEmail`
- The caregiver's UID is stored in `settings/{patientId}.caregiverUID`

### 2. Reminder Emails

When a patient's scheduled dose time arrives:
- The dashboard checks every 10 seconds for upcoming doses
- If it's time for a dose (within 1 minute window), an email is sent to the caregiver
- Email includes: Patient ID, dose type (morning/evening), scheduled time

### 3. Dose Status Emails

When a dose is taken or missed (logged by ESP8266 firmware):
- The dashboard detects new dose logs in real-time
- If a log is from the last 2 minutes, an email is sent
- Email includes: Patient ID, dose type, status (taken/missed), delay, current pill counts

### 4. Low Stock Emails

When pill count drops below 10:
- The dashboard monitors pill count changes in real-time
- If count drops from above 10 to 10 or below, an email is sent
- Email includes: Patient ID, dose type, current count

## Email Templates

All emails are HTML formatted with:
- Patient ID prominently displayed
- Dose type (morning/evening) with emoji indicators
- Current pill counts
- Timestamps
- Professional styling

## Testing

1. **Test Reminder Email:**
   - Set a patient's dose time to 1-2 minutes from now
   - Wait for the reminder to trigger
   - Check caregiver's email inbox

2. **Test Dose Status Email:**
   - Trigger a dose taken/missed via ESP8266
   - Check caregiver's email inbox

3. **Test Low Stock Email:**
   - Manually update pill count from 11 to 9 in Firestore
   - Check caregiver's email inbox

## Troubleshooting

### Emails Not Sending

1. **Check Backend Server:**
   - Ensure server is running: `http://localhost:3001/api/health`
   - Check server console for errors

2. **Check API Key:**
   - Verify `RESEND_API_KEY` is set correctly
   - Check Resend dashboard for API key status

3. **Check Caregiver Email:**
   - Verify `settings/{patientId}.caregiverEmail` exists
   - Ensure logged-in caregiver email matches

4. **Check Browser Console:**
   - Look for errors in browser console
   - Check network tab for failed API calls

### Duplicate Emails

- The system prevents duplicate emails by:
  - Checking if reminder was already sent (for reminders)
  - Only sending emails for logs from last 2 minutes (for dose status)
  - Only sending when count crosses threshold (for low stock)

## Production Deployment

For production, deploy the backend server to:
- Heroku
- Railway
- Render
- AWS EC2
- Google Cloud Run

Make sure to:
1. Set `RESEND_API_KEY` environment variable
2. Update `VITE_API_URL` in frontend to production URL
3. Verify your domain in Resend
4. Update `from` address in `server/index.js`

## Security Notes

- API key is stored server-side only (never exposed to frontend)
- Emails are only sent to the caregiver who assigned the patient
- All API calls are validated server-side
- CORS is enabled for frontend domain only

## Support

For issues or questions:
1. Check server logs for errors
2. Check browser console for frontend errors
3. Verify Resend API key is valid
4. Ensure caregiver email is stored correctly in Firestore
