# Pin Configuration Reference

## Current Hardware Setup (ESP8266)

This document describes the pin configuration for the existing hardware setup.

### Pin Assignments

| Function | Pin | GPIO | Description |
|----------|-----|------|-------------|
| IR Sensor 1 (Morning) | D1 | GPIO 5 | Detects morning pill removal |
| IR Sensor 2 (Night) | D2 | GPIO 4 | Detects night pill removal |
| LED1 (Morning) | D5 | GPIO 14 | Morning reminder LED |
| LED2 (Night) | D6 | GPIO 12 | Night reminder LED |
| Buzzer | D7 | GPIO 13 | Audio reminder |

### ESP8266 Pin Mapping

```
NodeMCU/Wemos D1 Mini Pin Mapping:
D0  = GPIO 16
D1  = GPIO 5   ← IR Sensor 1 (Morning)
D2  = GPIO 4   ← IR Sensor 2 (Night)
D3  = GPIO 0   (Boot mode, avoid)
D4  = GPIO 2   (Built-in LED, avoid)
D5  = GPIO 14  ← LED1 (Morning)
D6  = GPIO 12  ← LED2 (Night)
D7  = GPIO 13  ← Buzzer
D8  = GPIO 15  (Boot mode, avoid)
```

### Wiring Diagram

```
ESP8266 (NodeMCU)
│
├─ D1 (GPIO 5) ──── IR Sensor 1 OUT (Morning)
│                    ├─ VCC → 3.3V
│                    └─ GND → GND
│
├─ D2 (GPIO 4) ──── IR Sensor 2 OUT (Night)
│                    ├─ VCC → 3.3V
│                    └─ GND → GND
│
├─ D5 (GPIO 14) ─── 220Ω Resistor ─── LED1 Anode (Morning)
│                    └─ LED1 Cathode → GND
│
├─ D6 (GPIO 12) ─── 220Ω Resistor ─── LED2 Anode (Night)
│                    └─ LED2 Cathode → GND
│
└─ D7 (GPIO 13) ──── Buzzer Positive
                     └─ Buzzer Negative → GND
```

### IR Sensor Notes

- **Sensor Type**: Active LOW (LOW when object detected)
- **Pull-up**: Internal pull-up enabled (`INPUT_PULLUP`)
- **Detection**: When sensor is blocked, pin reads LOW
- **Debouncing**: Code includes debouncing to prevent multiple triggers

### LED Notes

- **Type**: Standard LEDs (3mm or 5mm)
- **Resistor**: 220Ω recommended (limits current to ~15mA)
- **Polarity**: Anode to pin, Cathode to GND
- **Brightness**: Can be adjusted by changing resistor value

### Buzzer Notes

- **Type**: Active buzzer (5V)
- **Connection**: Positive to D7, Negative to GND
- **Operation**: Blinks on/off every 500ms during reminder
- **Volume**: Can be adjusted with PWM if needed

### Power Requirements

- **ESP8266**: 3.3V, ~80mA (idle) to 170mA (WiFi active)
- **IR Sensors**: 3.3V, ~5mA each
- **LEDs**: 3.3V, ~15mA each (with 220Ω resistor)
- **Buzzer**: 5V, ~30mA
- **Total**: ~300mA peak (use 500mA+ power supply)

### Alternative Pin Configurations

If you need to change pins, update these defines in the firmware:

```cpp
#define IR_SENSOR_MORNING D1    // Change to desired pin
#define IR_SENSOR_EVENING D2    // Change to desired pin
#define LED1_PIN D5             // Change to desired pin
#define LED2_PIN D6             // Change to desired pin
#define BUZZER_PIN D7           // Change to desired pin
```

**Avoid these pins:**
- D0 (GPIO 16) - Used for wake from sleep
- D3 (GPIO 0) - Boot mode pin
- D4 (GPIO 2) - Boot mode pin, built-in LED
- D8 (GPIO 15) - Boot mode pin

### Testing Pins

To test individual components:

1. **Test IR Sensors:**
   ```cpp
   Serial.println(digitalRead(IR_SENSOR_MORNING));  // Should be HIGH when clear, LOW when blocked
   ```

2. **Test LEDs:**
   ```cpp
   digitalWrite(LED1_PIN, HIGH);  // Should turn on
   delay(1000);
   digitalWrite(LED1_PIN, LOW);     // Should turn off
   ```

3. **Test Buzzer:**
   ```cpp
   digitalWrite(BUZZER_PIN, HIGH);  // Should buzz
   delay(1000);
   digitalWrite(BUZZER_PIN, LOW);   // Should stop
   ```

