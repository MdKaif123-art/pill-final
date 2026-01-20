/*
 * SeniorPill - ESP8266 Smart Pill Dispenser Firmware (Firestore REST API)
 * 
 * Features:
 * - Firestore REST API integration (no deprecated secrets needed!)
 * - IR sensor detection for morning and evening doses
 * - Buzzer and LED reminders at scheduled times
 * - Offline mode with local storage and sync
 * - Automatic pill count management
 * - Missed dose detection and logging
 * 
 * Hardware Connections (Updated to match existing setup):
 * - IR Sensor 1 (Morning): D1
 * - IR Sensor 2 (Night): D2
 * - LED1 (Morning): D5
 * - LED2 (Night): D6
 * - Buzzer: D7
 * - WiFi: Built-in ESP8266
 * 
 * Libraries Required:
 * - WiFi (built-in)
 * - EEPROM (built-in)
 * - Time (built-in)
 * - ArduinoJson (by Benoit Blanchon)
 * - HTTPClient (built-in for ESP8266)
 * 
 * Author: SeniorPill Project
 * Date: 2024
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <EEPROM.h>
#include <time.h>
#include <ArduinoJson.h>

// ==================== CONFIGURATION ====================
// WiFi Credentials
#define WIFI_SSID "mdkaif"
#define WIFI_PASSWORD "123456789"

// Firebase Configuration (Firestore REST API)
#define FIREBASE_PROJECT_ID "pill-7577b"
#define FIREBASE_API_KEY "AIzaSyCarrWihyTgNfJPiMdZh0_g-lxBcCPuOBw"  // From your Firebase config

// Patient ID (should match the user UID in Firebase)
#define PATIENT_ID "U1"

// Hardware Pins (Updated to match your setup)
#define IR_SENSOR_MORNING D1    // IR1 (Morning)
#define IR_SENSOR_EVENING D2    // IR2 (Night)
#define LED1_PIN D5             // Morning LED
#define LED2_PIN D6             // Night LED
#define BUZZER_PIN D7

// Timing Configuration
#define DOSE_WINDOW_MINUTES 60  // Time window to take dose after reminder
#define REMINDER_INTERVAL_MS 500  // Buzzer blink interval (ms)

// EEPROM Addresses
#define EEPROM_SIZE 256
#define EEPROM_ADDR_MORNING_HOUR 0
#define EEPROM_ADDR_MORNING_MIN 1
#define EEPROM_ADDR_EVENING_HOUR 2
#define EEPROM_ADDR_EVENING_MIN 3
#define EEPROM_ADDR_PILL_COUNT 4
#define EEPROM_ADDR_OFFLINE_LOG_COUNT 10

// ==================== GLOBAL VARIABLES ====================
WiFiClientSecure client;
HTTPClient http;

// Device State
struct DeviceState {
  int morningHour;
  int morningMin;
  int eveningHour;
  int eveningMin;
  int morningPillCount;
  int eveningPillCount;
  bool deviceOnline;
  unsigned long lastSync;
  bool morningDoseTaken;
  bool eveningDoseTaken;
  bool morningReminderActive;
  bool eveningReminderActive;
  unsigned long morningReminderStartTime;
  unsigned long eveningReminderStartTime;
};

DeviceState deviceState;

// IR Sensor State
bool ir1Detected = false;
bool ir2Detected = false;

// Buzzer State
unsigned long lastBuzzMillis = 0;
bool buzzerState = false;

// Settings refresh timer
unsigned long lastSettingsFetchMs = 0;

// Cooldown flags
bool morningCooldown = false;
bool eveningCooldown = false;

// Offline Log Storage
struct DoseLog {
  String timestamp;
  String doseType;
  String status;
  int delayMinutes;
};

DoseLog offlineLogs[50];
int offlineLogCount = 0;

// Time Management
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 0;  // Adjust for your timezone (e.g., 19800 for IST)
const int daylightOffset_sec = 0;

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n=== SeniorPill ESP8266 Device Starting (Firestore API) ===");
  Serial.println("Hardware: Morning IR=D1, Night IR=D2, LED1=D5, LED2=D6, Buzzer=D7");
  
  // Initialize EEPROM
  EEPROM.begin(EEPROM_SIZE);
  
  // Initialize hardware pins
  pinMode(IR_SENSOR_MORNING, INPUT_PULLUP);
  pinMode(IR_SENSOR_EVENING, INPUT_PULLUP);
  pinMode(LED1_PIN, OUTPUT);
  pinMode(LED2_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  digitalWrite(LED1_PIN, LOW);
  digitalWrite(LED2_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  
  // Initialize device state
  deviceState.morningHour = -1;
  deviceState.morningMin = -1;
  deviceState.eveningHour = -1;
  deviceState.eveningMin = -1;
  deviceState.morningPillCount = 0;
  deviceState.eveningPillCount = 0;
  deviceState.deviceOnline = false;
  deviceState.lastSync = 0;
  deviceState.morningDoseTaken = false;
  deviceState.eveningDoseTaken = false;
  deviceState.morningReminderActive = false;
  deviceState.eveningReminderActive = false;
  
  // Load offline data
  loadOfflineData();
  loadSettingsFromEEPROM();
  
  // Connect to WiFi
  connectToWiFi();
  
  // Setup HTTPS client (skip certificate validation for now)
  client.setInsecure();
  
  // Sync time
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("Waiting for NTP time sync...");
  time_t now = time(nullptr);
  while (now < 8 * 3600 * 2) { // wait until time is set (year > 1970)
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println();
  struct tm* localTime = localtime(&now);
  struct tm* utcTime   = gmtime(&now);
  Serial.printf("✅ Time synced. Local: %02d:%02d:%02d | UTC: %02d:%02d:%02d | gmtOffset_sec=%ld\n",
                localTime->tm_hour, localTime->tm_min, localTime->tm_sec,
                utcTime->tm_hour, utcTime->tm_min, utcTime->tm_sec,
                gmtOffset_sec);
  
  // Load settings from Firestore (or use EEPROM if offline)
  if (deviceState.deviceOnline) {
    loadSettingsFromFirestore();
  } else {
    Serial.println("Using settings from EEPROM (offline mode)");
  }
  
  Serial.println("=== Device Ready ===");
  Serial.printf("Morning: %02d:%02d (%d pills) | Evening: %02d:%02d (%d pills)\n",
                deviceState.morningHour, deviceState.morningMin, deviceState.morningPillCount,
                deviceState.eveningHour, deviceState.eveningMin, deviceState.eveningPillCount);
}

// ==================== MAIN LOOP ====================
void loop() {
  unsigned long currentMillis = millis();
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    deviceState.deviceOnline = false;
    attemptWiFiReconnect();
  } else {
    if (!deviceState.deviceOnline) {
      // Just reconnected
      deviceState.deviceOnline = true;
      loadSettingsFromFirestore();
      syncOfflineLogs();
    }
    deviceState.deviceOnline = true;

    // Periodic settings refresh to pick up caregiver changes
    if (millis() - lastSettingsFetchMs > 60000) { // every 60s
      Serial.println("🔄 Refreshing settings from Firestore...");
      loadSettingsFromFirestore();
      lastSettingsFetchMs = millis();
    }
  }
  
  // Get current time
  time_t now = time(nullptr);
  struct tm* timeinfo = localtime(&now);
  
  if (timeinfo->tm_year > 100) {  // RTC is set (year > 2000)
    int currentHour = timeinfo->tm_hour;
    int currentMin = timeinfo->tm_min;
    int currentSec = timeinfo->tm_sec;
    
    // Debug: once per minute show current + schedule state
    static int lastLoggedMinute = -1;
    if (currentMin != lastLoggedMinute) {
      lastLoggedMinute = currentMin;
      Serial.printf("⏰ Now %02d:%02d:%02d | Morning %02d:%02d | Evening %02d:%02d\n",
                    currentHour, currentMin, currentSec,
                    deviceState.morningHour, deviceState.morningMin,
                    deviceState.eveningHour, deviceState.eveningMin);
      Serial.printf("   State: M(active:%d taken:%d cooldown:%d) | E(active:%d taken:%d cooldown:%d)\n",
                    deviceState.morningReminderActive, deviceState.morningDoseTaken, morningCooldown,
                    deviceState.eveningReminderActive, deviceState.eveningDoseTaken, eveningCooldown);
    }

    // Extra debug: every 10 seconds show current vs set times
    static int lastLoggedSecond = -1;
    if (currentSec % 10 == 0 && currentSec != lastLoggedSecond) {
      lastLoggedSecond = currentSec;
      Serial.printf("🕒 ESP time %02d:%02d:%02d | Scheduled M %02d:%02d | E %02d:%02d\n",
                    currentHour, currentMin, currentSec,
                    deviceState.morningHour, deviceState.morningMin,
                    deviceState.eveningHour, deviceState.eveningMin,
                    deviceState.eveningHour, deviceState.eveningMin);
    }
    
    // Check for scheduled reminders
    checkScheduledReminders(currentHour, currentMin);
    
    // Handle active reminders (buzzer blinking)
    handleActiveReminders();
  }
  
  // Check IR sensors for pill detection
  checkIRSensors();
  
  // Sync offline logs if online
  if (deviceState.deviceOnline && offlineLogCount > 0) {
    syncOfflineLogs();
  }
  
  // Update device status periodically
  if (currentMillis - deviceState.lastSync > 60000) {  // Every minute
    if (deviceState.deviceOnline) {
      updateDeviceStatus();
    }
    deviceState.lastSync = currentMillis;
  }
  
  delay(100);
}

// ==================== WIFI FUNCTIONS ====================
void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    deviceState.deviceOnline = true;
  } else {
    Serial.println("\nWiFi Connection Failed - Operating in Offline Mode");
    deviceState.deviceOnline = false;
  }
}

void attemptWiFiReconnect() {
  static unsigned long lastReconnectAttempt = 0;
  unsigned long currentMillis = millis();
  
  if (currentMillis - lastReconnectAttempt > 30000) {
    lastReconnectAttempt = currentMillis;
    Serial.println("Attempting WiFi reconnection...");
    WiFi.disconnect();
    WiFi.reconnect();
  }
}

// ==================== FIRESTORE REST API FUNCTIONS ====================
void loadSettingsFromFirestore() {
  if (!deviceState.deviceOnline) {
    return;
  }
  
  String url = "https://firestore.googleapis.com/v1/projects/" + String(FIREBASE_PROJECT_ID) + 
               "/databases/(default)/documents/settings/" + String(PATIENT_ID);
  
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.GET();
  
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    
    // Parse JSON response
    DynamicJsonDocument doc(2048);
    deserializeJson(doc, payload);
    
    // Extract fields - handle null values
    if (doc["fields"]["morningDoseTime"].containsKey("stringValue")) {
      String morningTime = doc["fields"]["morningDoseTime"]["stringValue"].as<String>();
      if (morningTime.length() >= 5) {
        deviceState.morningHour = morningTime.substring(0, 2).toInt();
        deviceState.morningMin = morningTime.substring(3, 5).toInt();
        Serial.printf("Morning time parsed: %02d:%02d\n", deviceState.morningHour, deviceState.morningMin);
      }
    } else {
      deviceState.morningHour = -1;
      deviceState.morningMin = -1;
      Serial.println("Morning time not set");
    }
    
    if (doc["fields"]["eveningDoseTime"].containsKey("stringValue")) {
      String eveningTime = doc["fields"]["eveningDoseTime"]["stringValue"].as<String>();
      if (eveningTime.length() >= 5) {
        deviceState.eveningHour = eveningTime.substring(0, 2).toInt();
        deviceState.eveningMin = eveningTime.substring(3, 5).toInt();
        Serial.printf("Evening time parsed: %02d:%02d\n", deviceState.eveningHour, deviceState.eveningMin);
      }
    } else {
      deviceState.eveningHour = -1;
      deviceState.eveningMin = -1;
      Serial.println("Evening time not set");
    }
    
    // Handle separate pill counts
    if (doc["fields"]["morningPillCount"].containsKey("integerValue")) {
      deviceState.morningPillCount = doc["fields"]["morningPillCount"]["integerValue"].as<int>();
    } else {
      deviceState.morningPillCount = 0;
    }
    
    if (doc["fields"]["eveningPillCount"].containsKey("integerValue")) {
      deviceState.eveningPillCount = doc["fields"]["eveningPillCount"]["integerValue"].as<int>();
    } else {
      deviceState.eveningPillCount = 0;
    }
    
    Serial.printf("✅ Settings fetched: Morning %02d:%02d (%d) | Evening %02d:%02d (%d)\n",
                  deviceState.morningHour, deviceState.morningMin, deviceState.morningPillCount,
                  deviceState.eveningHour, deviceState.eveningMin, deviceState.eveningPillCount);
    lastSettingsFetchMs = millis();
    saveSettingsToEEPROM();
    
    Serial.println("Settings loaded from Firestore");
    Serial.printf("Morning: %02d:%02d (%d pills) | Evening: %02d:%02d (%d pills)\n",
                  deviceState.morningHour, deviceState.morningMin, deviceState.morningPillCount,
                  deviceState.eveningHour, deviceState.eveningMin, deviceState.eveningPillCount);
  } else {
    Serial.printf("Failed to load settings: HTTP %d\n", httpCode);
    if (httpCode > 0) {
      Serial.println(http.getString());
    }
  }
  
  http.end();
}

void updateDeviceStatus() {
  if (!deviceState.deviceOnline) return;
  
  String url = "https://firestore.googleapis.com/v1/projects/" + String(FIREBASE_PROJECT_ID) + 
               "/databases/(default)/documents/settings/" + String(PATIENT_ID);
  
  // Create update mask
  String updateMask = "deviceStatus,lastSync";
  
  // Create JSON payload
  DynamicJsonDocument doc(512);
  doc["fields"]["deviceStatus"]["stringValue"] = deviceState.deviceOnline ? "online" : "offline";
  doc["fields"]["lastSync"]["timestampValue"] = getCurrentTimestampISO();
  
  String payload;
  serializeJson(doc, payload);
  
  url += "?updateMask.fieldPaths=deviceStatus&updateMask.fieldPaths=lastSync";
  
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.PATCH(payload);
  
  if (httpCode == HTTP_CODE_OK) {
    Serial.println("Device status updated");
  } else {
    Serial.printf("Failed to update status: HTTP %d\n", httpCode);
  }
  
  http.end();
}

void logDoseToFirestore(String doseType, String status, int delayMinutes) {
  if (!deviceState.deviceOnline) {
    storeOfflineLog(doseType, status, delayMinutes);
    return;
  }
  
  String url = "https://firestore.googleapis.com/v1/projects/" + String(FIREBASE_PROJECT_ID) + 
               "/databases/(default)/documents/doseLogs";
  
  // Create JSON payload
  DynamicJsonDocument doc(1024);
  doc["fields"]["patientId"]["stringValue"] = PATIENT_ID;
  doc["fields"]["doseType"]["stringValue"] = doseType;
  doc["fields"]["status"]["stringValue"] = status;
  doc["fields"]["delayMinutes"]["integerValue"] = delayMinutes;
  doc["fields"]["timestamp"]["timestampValue"] = getCurrentTimestampISO();
  doc["fields"]["createdAt"]["stringValue"] = getCurrentTimeString();
  
  String payload;
  serializeJson(doc, payload);
  
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST(payload);
  
  if (httpCode == HTTP_CODE_OK || httpCode == 201) {
    Serial.println("Dose logged to Firestore: " + doseType + " - " + status);
    
    if (status == "taken") {
      decrementPillCount(doseType);
    }
  } else {
    Serial.printf("Failed to log dose: HTTP %d\n", httpCode);
    if (httpCode > 0) {
      Serial.println(http.getString());
    }
    storeOfflineLog(doseType, status, delayMinutes);
  }
  
  http.end();
}

// Decrement pill count based on dose type (morning/evening)
void decrementPillCount(String doseType) {
  if (doseType == "morning") {
    deviceState.morningPillCount = max(0, deviceState.morningPillCount - 1);
  } else if (doseType == "evening") {
    deviceState.eveningPillCount = max(0, deviceState.eveningPillCount - 1);
  }
  
  if (deviceState.deviceOnline) {
    String url = "https://firestore.googleapis.com/v1/projects/" + String(FIREBASE_PROJECT_ID) + 
                 "/databases/(default)/documents/settings/" + String(PATIENT_ID);
    
    url += "?updateMask.fieldPaths=morningPillCount&updateMask.fieldPaths=eveningPillCount";
    
    DynamicJsonDocument doc(512);
    doc["fields"]["morningPillCount"]["integerValue"] = deviceState.morningPillCount;
    doc["fields"]["eveningPillCount"]["integerValue"] = deviceState.eveningPillCount;
    
    String payload;
    serializeJson(doc, payload);
    
    http.begin(client, url);
    http.addHeader("Content-Type", "application/json");
    
    int httpCode = http.PATCH(payload);
    
    if (httpCode == HTTP_CODE_OK) {
      Serial.printf("Pill count updated: Morning=%d, Evening=%d\n", 
                    deviceState.morningPillCount, deviceState.eveningPillCount);
    }
    
    http.end();
  }
  
  saveSettingsToEEPROM();
}

void syncOfflineLogs() {
  if (offlineLogCount == 0) return;
  
  Serial.println("Syncing offline logs: " + String(offlineLogCount));
  
  for (int i = 0; i < offlineLogCount; i++) {
    String url = "https://firestore.googleapis.com/v1/projects/" + String(FIREBASE_PROJECT_ID) + 
                 "/databases/(default)/documents/doseLogs";
    
    DynamicJsonDocument doc(1024);
    doc["fields"]["patientId"]["stringValue"] = PATIENT_ID;
    doc["fields"]["doseType"]["stringValue"] = offlineLogs[i].doseType;
    doc["fields"]["status"]["stringValue"] = offlineLogs[i].status;
    doc["fields"]["delayMinutes"]["integerValue"] = offlineLogs[i].delayMinutes;
    doc["fields"]["timestamp"]["timestampValue"] = offlineLogs[i].timestamp;
    doc["fields"]["createdAt"]["stringValue"] = offlineLogs[i].timestamp;
    
    String payload;
    serializeJson(doc, payload);
    
    http.begin(client, url);
    http.addHeader("Content-Type", "application/json");
    
    int httpCode = http.POST(payload);
    
    if (httpCode == HTTP_CODE_OK || httpCode == 201) {
      Serial.println("Synced log: " + offlineLogs[i].doseType);
      // Remove synced log
      for (int j = i; j < offlineLogCount - 1; j++) {
        offlineLogs[j] = offlineLogs[j + 1];
      }
      offlineLogCount--;
      i--;
    } else {
      Serial.printf("Failed to sync log: HTTP %d\n", httpCode);
      break;
    }
    
    http.end();
  }
  
  EEPROM.write(EEPROM_ADDR_OFFLINE_LOG_COUNT, offlineLogCount);
  EEPROM.commit();
}

// ==================== TIME FUNCTIONS ====================
String getCurrentTimestampISO() {
  time_t now = time(nullptr);
  struct tm* timeinfo = gmtime(&now);
  
  char buffer[30];
  snprintf(buffer, sizeof(buffer), "%04d-%02d-%02dT%02d:%02d:%02dZ",
           timeinfo->tm_year + 1900, timeinfo->tm_mon + 1, timeinfo->tm_mday,
           timeinfo->tm_hour, timeinfo->tm_min, timeinfo->tm_sec);
  return String(buffer);
}

String getCurrentTimeString() {
  time_t now = time(nullptr);
  struct tm* timeinfo = localtime(&now);
  
  char timeString[25];
  strftime(timeString, sizeof(timeString), "%Y-%m-%dT%H:%M:%S", timeinfo);
  return String(timeString);
}

// ==================== REMINDER FUNCTIONS ====================
void checkScheduledReminders(int currentHour, int currentMin) {
  // Debug: show evaluation each minute
  Serial.printf("🔍 Check reminders @ %02d:%02d | M %02d:%02d active:%d taken:%d cooldown:%d | E %02d:%02d active:%d taken:%d cooldown:%d\n",
                currentHour, currentMin,
                deviceState.morningHour, deviceState.morningMin, deviceState.morningReminderActive, deviceState.morningDoseTaken, morningCooldown,
                deviceState.eveningHour, deviceState.eveningMin, deviceState.eveningReminderActive, deviceState.eveningDoseTaken, eveningCooldown);
  
  // Morning Reminder
  if (deviceState.morningHour >= 0 && deviceState.morningMin >= 0 &&
      currentHour == deviceState.morningHour && 
      currentMin == deviceState.morningMin &&
      !morningCooldown && 
      !deviceState.morningReminderActive &&
      !deviceState.morningDoseTaken) {
    triggerReminder("morning");
    morningCooldown = true;
  }
  if (!(currentHour == deviceState.morningHour && currentMin == deviceState.morningMin)) {
    morningCooldown = false;
  }
  
  // Evening Reminder
  if (deviceState.eveningHour >= 0 && deviceState.eveningMin >= 0 &&
      currentHour == deviceState.eveningHour && 
      currentMin == deviceState.eveningMin &&
      !eveningCooldown && 
      !deviceState.eveningReminderActive &&
      !deviceState.eveningDoseTaken) {
    triggerReminder("evening");
    eveningCooldown = true;
  }
  if (!(currentHour == deviceState.eveningHour && currentMin == deviceState.eveningMin)) {
    eveningCooldown = false;
  }
  
  checkMissedDoses(currentHour, currentMin);
}

void triggerReminder(String doseType) {
  if (doseType == "morning") {
    digitalWrite(LED1_PIN, HIGH);
    deviceState.morningReminderActive = true;
    deviceState.morningReminderStartTime = millis();
    Serial.printf("💊 Trigger morning reminder at %02d:%02d\n", deviceState.morningHour, deviceState.morningMin);
  } else if (doseType == "evening") {
    digitalWrite(LED2_PIN, HIGH);
    deviceState.eveningReminderActive = true;
    deviceState.eveningReminderStartTime = millis();
    Serial.printf("💊 Trigger evening reminder at %02d:%02d\n", deviceState.eveningHour, deviceState.eveningMin);
  }
  
  buzzerState = true;
  digitalWrite(BUZZER_PIN, HIGH);
  lastBuzzMillis = millis();
}

void stopReminder(String doseType) {
  if (doseType == "morning") {
    digitalWrite(LED1_PIN, LOW);
    deviceState.morningReminderActive = false;
    deviceState.morningDoseTaken = true;
    Serial.println("✅ Morning pill taken");
  } else if (doseType == "evening") {
    digitalWrite(LED2_PIN, LOW);
    deviceState.eveningReminderActive = false;
    deviceState.eveningDoseTaken = true;
    Serial.println("✅ Night pill taken");
  }
  
  buzzerState = false;
  digitalWrite(BUZZER_PIN, LOW);
}

void handleActiveReminders() {
  if (deviceState.morningReminderActive || deviceState.eveningReminderActive) {
    if (millis() - lastBuzzMillis >= REMINDER_INTERVAL_MS) {
      lastBuzzMillis = millis();
      buzzerState = !buzzerState;
      digitalWrite(BUZZER_PIN, buzzerState);
      
      if (deviceState.morningReminderActive) {
        digitalWrite(LED1_PIN, buzzerState);
      }
      if (deviceState.eveningReminderActive) {
        digitalWrite(LED2_PIN, buzzerState);
      }
    }
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }
}

void checkMissedDoses(int currentHour, int currentMin) {
  // Check morning dose
  if (deviceState.morningReminderActive) {
    unsigned long elapsedMinutes = (millis() - deviceState.morningReminderStartTime) / 60000;
    if (elapsedMinutes > DOSE_WINDOW_MINUTES) {
      stopReminder("morning");
      logDoseToFirestore("morning", "missed", 0);
      Serial.println("❌ Morning dose missed");
      deviceState.morningDoseTaken = false;
    }
  }
  
  // Check evening dose
  if (deviceState.eveningReminderActive) {
    unsigned long elapsedMinutes = (millis() - deviceState.eveningReminderStartTime) / 60000;
    if (elapsedMinutes > DOSE_WINDOW_MINUTES) {
      stopReminder("evening");
      logDoseToFirestore("evening", "missed", 0);
      Serial.println("❌ Night dose missed");
      deviceState.eveningDoseTaken = false;
    }
  }
  
  // Reset daily flags at midnight
  static int lastDay = -1;
  time_t now = time(nullptr);
  struct tm* timeinfo = localtime(&now);
  if (lastDay != -1 && timeinfo->tm_mday != lastDay) {
    deviceState.morningDoseTaken = false;
    deviceState.eveningDoseTaken = false;
    Serial.println("New day - resetting dose flags");
  }
  lastDay = timeinfo->tm_mday;
}

// ==================== IR SENSOR FUNCTIONS ====================
void checkIRSensors() {
  static unsigned long lastCheck = 0;
  unsigned long currentMillis = millis();
  
  if (currentMillis - lastCheck < 500) return;
  lastCheck = currentMillis;
  
  // Morning IR Sensor (D1)
  if (deviceState.morningReminderActive && 
      digitalRead(IR_SENSOR_MORNING) == LOW && 
      !ir1Detected) {
    ir1Detected = true;
    handleDoseTaken("morning");
  }
  if (digitalRead(IR_SENSOR_MORNING) == HIGH) {
    ir1Detected = false;
  }
  
  // Evening IR Sensor (D2)
  if (deviceState.eveningReminderActive && 
      digitalRead(IR_SENSOR_EVENING) == LOW && 
      !ir2Detected) {
    ir2Detected = true;
    handleDoseTaken("evening");
  }
  if (digitalRead(IR_SENSOR_EVENING) == HIGH) {
    ir2Detected = false;
  }
}

void handleDoseTaken(String doseType) {
  stopReminder(doseType);
  
  unsigned long delayMinutes = 0;
  if (doseType == "morning") {
    delayMinutes = (millis() - deviceState.morningReminderStartTime) / 60000;
  } else {
    delayMinutes = (millis() - deviceState.eveningReminderStartTime) / 60000;
  }
  
  logDoseToFirestore(doseType, "taken", delayMinutes);
  Serial.printf("✅ %s pill taken (delay: %lu min)\n", doseType.c_str(), delayMinutes);
}

// ==================== EEPROM FUNCTIONS ====================
void saveSettingsToEEPROM() {
  EEPROM.write(EEPROM_ADDR_MORNING_HOUR, deviceState.morningHour);
  EEPROM.write(EEPROM_ADDR_MORNING_MIN, deviceState.morningMin);
  EEPROM.write(EEPROM_ADDR_EVENING_HOUR, deviceState.eveningHour);
  EEPROM.write(EEPROM_ADDR_EVENING_MIN, deviceState.eveningMin);
  EEPROM.write(EEPROM_ADDR_PILL_COUNT, deviceState.morningPillCount); // Store morning count
  EEPROM.write(EEPROM_ADDR_PILL_COUNT + 1, deviceState.eveningPillCount); // Store evening count
  EEPROM.commit();
}

void loadSettingsFromEEPROM() {
  deviceState.morningHour = EEPROM.read(EEPROM_ADDR_MORNING_HOUR);
  deviceState.morningMin = EEPROM.read(EEPROM_ADDR_MORNING_MIN);
  deviceState.eveningHour = EEPROM.read(EEPROM_ADDR_EVENING_HOUR);
  deviceState.eveningMin = EEPROM.read(EEPROM_ADDR_EVENING_MIN);
  deviceState.morningPillCount = EEPROM.read(EEPROM_ADDR_PILL_COUNT);
  deviceState.eveningPillCount = EEPROM.read(EEPROM_ADDR_PILL_COUNT + 1);
  
  if (deviceState.morningHour == 255) deviceState.morningHour = -1;
  if (deviceState.morningMin == 255) deviceState.morningMin = -1;
  if (deviceState.eveningHour == 255) deviceState.eveningHour = -1;
  if (deviceState.eveningMin == 255) deviceState.eveningMin = -1;
  if (deviceState.morningPillCount == 255) deviceState.morningPillCount = 0;
  if (deviceState.eveningPillCount == 255) deviceState.eveningPillCount = 0;
}

void loadOfflineData() {
  offlineLogCount = EEPROM.read(EEPROM_ADDR_OFFLINE_LOG_COUNT);
  if (offlineLogCount == 255) offlineLogCount = 0;
  if (offlineLogCount > 50) offlineLogCount = 0;
}

void storeOfflineLog(String doseType, String status, int delayMinutes) {
  if (offlineLogCount >= 50) {
    Serial.println("Offline log storage full!");
    return;
  }
  
  offlineLogs[offlineLogCount].timestamp = getCurrentTimestampISO();
  offlineLogs[offlineLogCount].doseType = doseType;
  offlineLogs[offlineLogCount].status = status;
  offlineLogs[offlineLogCount].delayMinutes = delayMinutes;
  offlineLogCount++;
  
  EEPROM.write(EEPROM_ADDR_OFFLINE_LOG_COUNT, offlineLogCount);
  EEPROM.commit();
  Serial.println("Stored offline log: " + doseType);
}

