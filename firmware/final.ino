// ================= SMART PILL – FIRESTORE VERSION =================
// Based on your working Blynk sketch (Morning / Night) but:
// - NO Blynk
// - Fetches times & pill counts from Firestore settings/{PATIENT_ID}
// - Logs taken/missed doses to Firestore doseLogs
// - Uses NTP time (time.h) instead of Blynk RTC / TimeLib
// ==================================================================

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <EEPROM.h>
#include <ArduinoJson.h>
#include <time.h>

// ====== WiFi ======
const char* WIFI_SSID = "mdkaif";
const char* WIFI_PASS = "123456789";

// ====== Firebase / Firestore ======
#define FIREBASE_PROJECT_ID "pill-7577b"
#define FIREBASE_API_KEY    "AIzaSyCarrWihyTgNfJPiMdZh0_g-lxBcCPuOBw"

// Use the custom UID (e.g. U1) that caregiver assigned and device uses
#define PATIENT_ID "U1"

// ====== Hardware Pins ======
#define LED1_PIN D5   // Morning LED
#define LED2_PIN D6   // Night LED
#define BUZZER_PIN D7
#define IR1_PIN  D1   // IR1 (Morning)
#define IR2_PIN  D2   // IR2 (Night)

// ====== Time / NTP ======
const char* ntpServer = "pool.ntp.org";
// IMPORTANT: set this for your timezone (IST = 19800)
const long gmtOffset_sec = 19800;   // change if needed
const int  daylightOffset_sec = 0;

// ====== State ======
WiFiClientSecure client;
HTTPClient http;

// Morning / Night times
int pill1Hour = -1, pill1Min = -1; // Morning
int pill2Hour = -1, pill2Min = -1; // Night

// Active flags and IR state
bool pill1Active = false; // Morning reminder active
bool pill2Active = false; // Night reminder active
bool ir1Detected = false, ir2Detected = false;

// Pill counts
int remainingPill1 = 0; // Morning
int remainingPill2 = 0; // Night

// Buzzer state
unsigned long lastBuzzMillis = 0;
bool buzzerState = false;

// Cooldowns (avoid multiple triggers in same minute)
bool pill1Cooldown = false;
bool pill2Cooldown = false;

// Track if missed has been logged (to avoid duplicate logs)
bool pill1MissedLogged = false;
bool pill2MissedLogged = false;

// Timers
unsigned long lastTimeCheckMs = 0;
unsigned long lastIRCheckMs   = 0;
unsigned long lastSettingsFetchMs = 0;

// Dose window (for missed detection) - 1 minute window
#define DOSE_WINDOW_MINUTES 1
unsigned long pill1StartMs = 0;
unsigned long pill2StartMs = 0;

// Track last device status sync
unsigned long lastDeviceStatusSyncMs = 0;
bool lastStatusOnline = false;

// ================= EEPROM SAVE / LOAD =================
void saveToEEPROM() {
  EEPROM.write(0, pill1Hour);
  EEPROM.write(1, pill1Min);
  EEPROM.write(2, pill2Hour);
  EEPROM.write(3, pill2Min);
  EEPROM.write(4, remainingPill1);
  EEPROM.write(5, remainingPill2);
  EEPROM.commit();
}

void loadFromEEPROM() {
  pill1Hour = EEPROM.read(0);
  pill1Min  = EEPROM.read(1);
  pill2Hour = EEPROM.read(2);
  pill2Min  = EEPROM.read(3);
  remainingPill1 = EEPROM.read(4);
  remainingPill2 = EEPROM.read(5);

  if (pill1Hour == 255) pill1Hour = -1;
  if (pill1Min  == 255) pill1Min  = -1;
  if (pill2Hour == 255) pill2Hour = -1;
  if (pill2Min  == 255) pill2Min  = -1;
  if (remainingPill1 == 255) remainingPill1 = 0;
  if (remainingPill2 == 255) remainingPill2 = 0;
}

// ================= WIFI / TIME =================
void connectWiFi() {
  Serial.printf("Connecting to %s ...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 40) {
    delay(250);
    Serial.print(".");
    tries++;
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("WiFi OK, IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("WiFi FAILED");
  }
}

String isoNow() {
  time_t now = time(nullptr);
  struct tm* t = gmtime(&now);
  char buf[30];
  snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02dZ",
           t->tm_year + 1900, t->tm_mon + 1, t->tm_mday,
           t->tm_hour, t->tm_min, t->tm_sec);
  return String(buf);
}

// ================= FIRESTORE HELPERS =================
bool fetchSettingsFromFirestore() {
  if (WiFi.status() != WL_CONNECTED) return false;
  String url = "https://firestore.googleapis.com/v1/projects/" + String(FIREBASE_PROJECT_ID) +
               "/databases/(default)/documents/settings/" + PATIENT_ID;

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.GET();

  if (code == HTTP_CODE_OK) {
    String payload = http.getString();
    DynamicJsonDocument doc(2048);
    deserializeJson(doc, payload);
    JsonObject fields = doc["fields"];

    // Times: morningDoseTime / eveningDoseTime ("HH:MM")
    if (fields["morningDoseTime"]["stringValue"]) {
      String t = fields["morningDoseTime"]["stringValue"].as<String>();
      if (t.length() >= 5) {
        pill1Hour = t.substring(0,2).toInt();
        pill1Min  = t.substring(3,5).toInt();
      }
    }

    if (fields["eveningDoseTime"]["stringValue"]) {
      String t = fields["eveningDoseTime"]["stringValue"].as<String>();
      if (t.length() >= 5) {
        pill2Hour = t.substring(0,2).toInt();
        pill2Min  = t.substring(3,5).toInt();
      }
    }

    // Counts
    remainingPill1 = fields["morningPillCount"]["integerValue"] ?
                     fields["morningPillCount"]["integerValue"].as<int>() : remainingPill1;
    remainingPill2 = fields["eveningPillCount"]["integerValue"] ?
                     fields["eveningPillCount"]["integerValue"].as<int>() : remainingPill2;

    Serial.printf("✅ Settings from Firestore: M %02d:%02d (%d) | N %02d:%02d (%d)\n",
                  pill1Hour, pill1Min, remainingPill1,
                  pill2Hour, pill2Min, remainingPill2);

    saveToEEPROM();
    http.end();
    return true;
  } else {
    Serial.printf("⚠️ Settings fetch failed HTTP %d\n", code);
  }
  http.end();
  return false;
}

void patchPillCountsToFirestore() {
  if (WiFi.status() != WL_CONNECTED) return;
  String url = "https://firestore.googleapis.com/v1/projects/" + String(FIREBASE_PROJECT_ID) +
               "/databases/(default)/documents/settings/" + PATIENT_ID +
               "?updateMask.fieldPaths=morningPillCount&updateMask.fieldPaths=eveningPillCount";

  DynamicJsonDocument doc(256);
  doc["fields"]["morningPillCount"]["integerValue"] = remainingPill1;
  doc["fields"]["eveningPillCount"]["integerValue"] = remainingPill2;

  String payload; serializeJson(doc, payload);
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.PATCH(payload);
  Serial.printf("Pill count PATCH HTTP %d (M=%d E=%d)\n", code, remainingPill1, remainingPill2);
  http.end();
}

void logDoseToFirestore(String doseType, String status, int delaySeconds) {
  if (WiFi.status() != WL_CONNECTED) return;
  String url = "https://firestore.googleapis.com/v1/projects/" + String(FIREBASE_PROJECT_ID) +
               "/databases/(default)/documents/doseLogs";

  DynamicJsonDocument doc(512);
  doc["fields"]["patientId"]["stringValue"]    = PATIENT_ID;
  doc["fields"]["doseType"]["stringValue"]     = doseType;
  doc["fields"]["status"]["stringValue"]       = status;
  doc["fields"]["delaySeconds"]["integerValue"]= delaySeconds;
  // Keep delayMinutes for backward compatibility (calculated from seconds)
  doc["fields"]["delayMinutes"]["integerValue"]= delaySeconds / 60;
  doc["fields"]["timestamp"]["timestampValue"] = isoNow();
  doc["fields"]["createdAt"]["stringValue"]    = isoNow();

  String payload; serializeJson(doc, payload);
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(payload);
  Serial.printf("Log %s/%s HTTP %d (delay: %d seconds)\n", doseType.c_str(), status.c_str(), code, delaySeconds);
  http.end();
}

// ================= DEVICE STATUS =================
// Update settings/{PATIENT_ID}.deviceStatus + lastSync so dashboard shows online/offline correctly
void updateDeviceStatusInFirestore(bool online) {
  if (WiFi.status() != WL_CONNECTED) return;

  String url = "https://firestore.googleapis.com/v1/projects/" + String(FIREBASE_PROJECT_ID) +
               "/databases/(default)/documents/settings/" + PATIENT_ID +
               "?updateMask.fieldPaths=deviceStatus&updateMask.fieldPaths=lastSync";

  DynamicJsonDocument doc(256);
  doc["fields"]["deviceStatus"]["stringValue"] = online ? "online" : "offline";
  doc["fields"]["lastSync"]["timestampValue"] = isoNow();

  String payload; serializeJson(doc, payload);

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.PATCH(payload);
  Serial.printf("Device status PATCH HTTP %d (%s)\n", code, online ? "online" : "offline");
  http.end();
}

// ================= REMINDERS / IR =================
void triggerReminder(int pillNo) {
  if (pillNo == 1 && !pill1Active) {
    digitalWrite(LED1_PIN, HIGH);
    pill1Active = true;
    pill1StartMs = millis();
    pill1MissedLogged = false; // Reset missed flag when reminder starts
    Serial.println("💊 Time to take morning pills");
  } else if (pillNo == 2 && !pill2Active) {
    digitalWrite(LED2_PIN, HIGH);
    pill2Active = true;
    pill2StartMs = millis();
    pill2MissedLogged = false; // Reset missed flag when reminder starts
    Serial.println("💊 Time to take night pills");
  }
  digitalWrite(BUZZER_PIN, HIGH);
  buzzerState = true;
  lastBuzzMillis = millis();
}

void stopReminder(int pillNo) {
  if (pillNo == 1) {
    digitalWrite(LED1_PIN, LOW);
    pill1Active = false;
    pill1MissedLogged = false; // Reset when stopped
    Serial.println("Morning reminder stopped");
  } else if (pillNo == 2) {
    digitalWrite(LED2_PIN, LOW);
    pill2Active = false;
    pill2MissedLogged = false; // Reset when stopped
    Serial.println("Night reminder stopped");
  }
  // Only turn off buzzer if no other reminder is active
  if (!pill1Active && !pill2Active) {
    digitalWrite(BUZZER_PIN, LOW);
    buzzerState = false;
  }
}

void handleBuzz() {
  if (pill1Active || pill2Active) {
    if (millis() - lastBuzzMillis >= 500) {
      lastBuzzMillis = millis();
      buzzerState = !buzzerState;
      digitalWrite(BUZZER_PIN, buzzerState);
    }
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }
}

void checkMissed() {
  // Check morning dose - after exactly 1 minute (60 seconds)
  if (pill1Active) {
    unsigned long elapsedSeconds = (millis() - pill1StartMs) / 1000;
    if (elapsedSeconds >= (DOSE_WINDOW_MINUTES * 60) && !pill1MissedLogged) {
      // Turn off LED and buzzer immediately
      digitalWrite(LED1_PIN, LOW);
      pill1Active = false;
      pill1MissedLogged = true;
      
      // Turn off buzzer if no other reminder is active
      if (!pill2Active) {
        digitalWrite(BUZZER_PIN, LOW);
        buzzerState = false;
      }
      
      // Log as missed
      logDoseToFirestore("morning", "missed", elapsedSeconds);
      Serial.printf("❌ Morning dose missed after %lu seconds - LED and buzzer turned off\n", elapsedSeconds);
    }
  }
  
  // Check evening dose - after exactly 1 minute (60 seconds)
  if (pill2Active) {
    unsigned long elapsedSeconds = (millis() - pill2StartMs) / 1000;
    if (elapsedSeconds >= (DOSE_WINDOW_MINUTES * 60) && !pill2MissedLogged) {
      // Turn off LED and buzzer immediately
      digitalWrite(LED2_PIN, LOW);
      pill2Active = false;
      pill2MissedLogged = true;
      
      // Turn off buzzer if no other reminder is active
      if (!pill1Active) {
        digitalWrite(BUZZER_PIN, LOW);
        buzzerState = false;
      }
      
      // Log as missed
      logDoseToFirestore("evening", "missed", elapsedSeconds);
      Serial.printf("❌ Night dose missed after %lu seconds - LED and buzzer turned off\n", elapsedSeconds);
    }
  }
}

void checkTimeAndReminders() {
  time_t now = time(nullptr);
  struct tm* t = localtime(&now);
  if (t->tm_year < 100) return;  // time not set

  int currentHour = t->tm_hour;
  int currentMin  = t->tm_min;
  static int lastMin = -1;

  if (currentMin != lastMin) {
    lastMin = currentMin;
    Serial.printf("⏰ %02d:%02d | Morning:%02d:%02d | Night:%02d:%02d\n",
                  currentHour, currentMin, pill1Hour, pill1Min, pill2Hour, pill2Min);
  }

  // Morning Reminder
  if (pill1Hour >= 0 && pill1Min >= 0 &&
      currentHour == pill1Hour && currentMin == pill1Min &&
      !pill1Cooldown) {
    triggerReminder(1);
    pill1Cooldown = true;
  }
  if (!(currentHour == pill1Hour && currentMin == pill1Min))
    pill1Cooldown = false;

  // Night Reminder
  if (pill2Hour >= 0 && pill2Min >= 0 &&
      currentHour == pill2Hour && currentMin == pill2Min &&
      !pill2Cooldown) {
    triggerReminder(2);
    pill2Cooldown = true;
  }
  if (!(currentHour == pill2Hour && currentMin == pill2Min))
    pill2Cooldown = false;

  handleBuzz();
  checkMissed();
}

void checkIR() {
  // Morning IR - only check if reminder is still active (not missed yet)
  if (pill1Active && !pill1MissedLogged && digitalRead(IR1_PIN) == LOW && !ir1Detected) {
    ir1Detected = true;
    stopReminder(1);
    remainingPill1 = max(remainingPill1 - 1, 0);
    patchPillCountsToFirestore();
    int delaySeconds = (int)((millis() - pill1StartMs) / 1000);
    logDoseToFirestore("morning", "taken", delaySeconds);
    Serial.printf("✅ Morning pill taken (IR1) - Delay: %d seconds\n", delaySeconds);
    saveToEEPROM();
  }
  if (digitalRead(IR1_PIN) == HIGH) ir1Detected = false;

  // Night IR - only check if reminder is still active (not missed yet)
  if (pill2Active && !pill2MissedLogged && digitalRead(IR2_PIN) == LOW && !ir2Detected) {
    ir2Detected = true;
    stopReminder(2);
    remainingPill2 = max(remainingPill2 - 1, 0);
    patchPillCountsToFirestore();
    int delaySeconds = (int)((millis() - pill2StartMs) / 1000);
    logDoseToFirestore("evening", "taken", delaySeconds);
    Serial.printf("✅ Night pill taken (IR2) - Delay: %d seconds\n", delaySeconds);
    saveToEEPROM();
  }
  if (digitalRead(IR2_PIN) == HIGH) ir2Detected = false;
}

// ================= SETUP / LOOP =================
void setup() {
  Serial.begin(115200);
  EEPROM.begin(32);

  pinMode(LED1_PIN, OUTPUT);
  pinMode(LED2_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(IR1_PIN, INPUT_PULLUP);
  pinMode(IR2_PIN, INPUT_PULLUP);

  digitalWrite(LED1_PIN, LOW);
  digitalWrite(LED2_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  connectWiFi();
  client.setInsecure();

  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("Waiting for NTP time...");
  time_t now = time(nullptr);
  while (now < 8 * 3600) { delay(500); Serial.print("."); now = time(nullptr); }
  Serial.println();

  loadFromEEPROM();
  fetchSettingsFromFirestore();

  Serial.println("✅ Smart Pill Dispenser (Firestore) Initialized");

  // Initial status update
  updateDeviceStatusInFirestore(WiFi.status() == WL_CONNECTED);
  lastDeviceStatusSyncMs = millis();
  lastStatusOnline = (WiFi.status() == WL_CONNECTED);
}

void loop() {
  bool currentlyOnline = (WiFi.status() == WL_CONNECTED);
  if (!currentlyOnline) {
    connectWiFi();
    currentlyOnline = (WiFi.status() == WL_CONNECTED);
  }

  unsigned long nowMs = millis();

  // Check time & reminders every 1s
  if (nowMs - lastTimeCheckMs >= 1000) {
    lastTimeCheckMs = nowMs;
    checkTimeAndReminders();
  }

  // Check IR every 300ms
  if (nowMs - lastIRCheckMs >= 300) {
    lastIRCheckMs = nowMs;
    checkIR();
  }

  // Refresh settings every 60s (in case caregiver changes times)
  if (nowMs - lastSettingsFetchMs >= 60000) {
    lastSettingsFetchMs = nowMs;
    Serial.println("🔄 Refresh settings from Firestore...");
    fetchSettingsFromFirestore();
  }

  // Sync device status every 60s or when online/offline changes
  if (nowMs - lastDeviceStatusSyncMs >= 60000 || currentlyOnline != lastStatusOnline) {
    updateDeviceStatusInFirestore(currentlyOnline);
    lastDeviceStatusSyncMs = nowMs;
    lastStatusOnline = currentlyOnline;
  }
}