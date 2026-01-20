# ESP8266/ESP32 Firmware Setup Guide

## Hardware Requirements

- ESP8266 Development Board (NodeMCU/Wemos D1 Mini)
- IR Sensor Module x2 (for morning and evening dose detection)
- Buzzer (5V active buzzer)
- LED x2 (with appropriate resistors)
- Jumper wires
- Breadboard (optional)

## Hardware Connections

### ESP8266 Pin Configuration (Current Setup)

| Component | ESP8266 Pin | Notes |
|-----------|-------------|-------|
| IR Sensor 1 (Morning) | D1 | Connect VCC to 3.3V, GND to GND, OUT to D1 |
| IR Sensor 2 (Night) | D2 | Connect VCC to 3.3V, GND to GND, OUT to D2 |
| LED1 (Morning) | D5 | Connect through 220Ω resistor to D5, cathode to GND |
| LED2 (Night) | D6 | Connect through 220Ω resistor to D6, cathode to GND |
| Buzzer | D7 | Connect positive to D7, negative to GND |

### ESP32 Pin Configuration (Alternative)

| Component | ESP32 Pin | Notes |
|-----------|-----------|-------|
| IR Sensor 1 (Morning) | GPIO 4 | Connect VCC to 3.3V, GND to GND, OUT to GPIO 4 |
| IR Sensor 2 (Evening) | GPIO 5 | Connect VCC to 3.3V, GND to GND, OUT to GPIO 5 |
| Buzzer | GPIO 18 | Connect positive to GPIO 18, negative to GND |
| LED | GPIO 19 | Connect through 220Ω resistor to GPIO 19, cathode to GND |

## Library Installation

### For ESP8266:
1. **Firebase ESP8266 Client Library**
   - Go to: Tools → Manage Libraries
   - Search: "Firebase ESP8266 Client"
   - Install by: Mobizt

2. **ArduinoJson**
   - Search: "ArduinoJson"
   - Install by: Benoit Blanchon

### For ESP32:
1. **Firebase ESP32 Client Library**
   - Search: "Firebase ESP32 Client"
   - Install by: Mobizt

2. **ArduinoJson** (usually auto-installed with Firebase)

## Configuration

Before uploading, update the following in the firmware file:

1. **WiFi Credentials:**
   ```cpp
   #define WIFI_SSID "YOUR_WIFI_SSID"
   #define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
   ```

2. **Firebase Configuration:**
   - Get your Realtime Database URL from Firebase Console
   - Get your Database Secret from Firebase Console → Project Settings → Service Accounts → Database secrets
   ```cpp
   #define FIREBASE_HOST "your-project.firebaseio.com"
   #define FIREBASE_AUTH "your-database-secret"
   ```

3. **Patient ID:**
   - Use the Firebase Authentication UID of the patient
   ```cpp
   #define PATIENT_ID "patient-firebase-uid"
   ```

4. **Time Zone (Optional):**
   ```cpp
   const long gmtOffset_sec = 19800;  // IST = UTC+5:30 (19800 seconds)
   ```

## Upload Instructions

### For ESP8266:
1. Open Arduino IDE
2. Select Board: Tools → Board → NodeMCU 1.0 (ESP-12E Module) or your ESP8266 board
3. Select Port: Tools → Port → (your ESP8266 port)
4. Upload the sketch `SeniorPill_ESP8266.ino`

### For ESP32:
1. Open Arduino IDE
2. Select Board: Tools → Board → ESP32 Dev Module
3. Select Port: Tools → Port → (your ESP32 port)
4. Set Partition Scheme: Tools → Partition Scheme → Default 4MB with spiffs
5. Upload the sketch `SeniorPill_ESP32.ino`

## Testing

1. Open Serial Monitor (115200 baud)
2. Check for successful WiFi connection
3. Verify Firebase connection
4. Test IR sensors by blocking them (should read LOW when blocked)
5. Verify reminders trigger at scheduled times
6. Check that LEDs and buzzer activate during reminders

## Troubleshooting

- **WiFi Connection Failed:** Check SSID and password, ensure 2.4GHz network
- **Firebase Connection Failed:** Verify host and auth token, check Firebase console
- **IR Sensors Not Working:** 
  - Check wiring connections
  - Verify sensor type (some are active HIGH, code uses INPUT_PULLUP for active LOW)
  - Test with Serial Monitor to see sensor readings
- **Time Not Syncing:** Check NTP server accessibility, adjust timezone offset
- **Reminders Not Triggering:** Verify time is synced correctly, check scheduled times in Firebase
- **EEPROM Issues:** Clear EEPROM by uploading a blank sketch if settings are corrupted

## Features

- ✅ Real-time Firebase sync
- ✅ Offline mode with local storage
- ✅ Automatic dose detection
- ✅ Missed dose logging
- ✅ Pill count management
- ✅ Scheduled reminders

