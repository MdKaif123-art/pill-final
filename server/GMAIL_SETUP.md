# Gmail SMTP Setup Guide

This server now uses Gmail SMTP to send emails. It works immediately without domain verification!

## Quick Setup (5 minutes)

### Step 1: Enable 2-Step Verification
1. Go to your Google Account: https://myaccount.google.com/
2. Click **Security** in the left sidebar
3. Under "Signing in to Google", click **2-Step Verification**
4. Follow the steps to enable it (you'll need your phone)

### Step 2: Create App Password
1. Still in Security settings, click **App passwords** (below 2-Step Verification)
2. Select **Mail** as the app
3. Select **Other (Custom name)** as the device
4. Enter "SeniorPill Server" as the name
5. Click **Generate**
6. **Copy the 16-character password** (it looks like: `abcd efgh ijkl mnop`)

### Step 3: Update Server Configuration
1. Open `server/index.js`
2. Find these lines (around line 10-11):
   ```javascript
   const GMAIL_USER = 'waste7428@gmail.com'; // Your Gmail address
   const GMAIL_APP_PASSWORD = 'your_app_password_here'; // Gmail App Password
   ```
3. Replace `waste7428@gmail.com` with your Gmail address
4. Replace `your_app_password_here` with the 16-character App Password (remove spaces)
5. Save the file

### Step 4: Restart Server
```bash
npm start
```

## That's It! 🎉

Emails will now be sent directly to caregiver email addresses. No domain verification needed!

## Testing

Send a test email:
```bash
curl -X POST http://localhost:3001/api/email/reminder \
  -H "Content-Type: application/json" \
  -d '{
    "caregiverEmail": "recipient@example.com",
    "patientId": "U1",
    "doseType": "morning",
    "scheduledTime": "09:00",
    "morningPillCount": 25,
    "eveningPillCount": 30,
    "missedDosesToday": 0
  }'
```

## Troubleshooting

### "Invalid login" error
- Make sure you're using an **App Password**, not your regular Gmail password
- Make sure 2-Step Verification is enabled
- Remove spaces from the App Password when pasting

### "Less secure app access" error
- This shouldn't happen with App Passwords, but if it does:
  - Make sure you're using an App Password, not regular password
  - Check that 2-Step Verification is enabled

### Emails going to spam
- This is normal for automated emails
- Recipients should check their spam folder
- Over time, as emails are marked as "not spam", deliverability improves

## Advantages of Gmail SMTP

✅ **Works immediately** - No domain verification needed  
✅ **Free** - Uses your existing Gmail account  
✅ **Reliable** - Gmail's infrastructure  
✅ **No limits** - Can send to any email address  
✅ **Easy setup** - Just need App Password  

## Daily Limits

Gmail allows:
- **500 emails per day** for free accounts
- **2000 emails per day** for Google Workspace accounts

This should be more than enough for medication reminders!
