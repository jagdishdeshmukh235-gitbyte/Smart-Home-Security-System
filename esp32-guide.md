# Direct ESP32 Microcontroller Integration Guide

This guide details how your physical ESP32 device connects directly to this web dashboard over your local network using direct HTTP REST endpoints.

---

## 1. Hardware Pin Assignments
Based on your project's hardware, the standard physical wiring assignments are:

* **MQ2 Gas Sensor**: `GPIO 32` (Analog Input)
* **Flame Sensor**: `GPIO 34` (Digital Input)
* **Vibration Sensor**: `GPIO 25` (Digital Input)
* **SG90 Servo Motor**: `GPIO 18` (PWM Output)
* **Keypad (4x4 matrix)**:
  * Rows: `GPIO 4, 5, 19, 21`
  * Columns: `GPIO 22, 23, 27, 14`
  * Default PIN: `"9608"` (confirm key: `#`)

---

## 2. HTTP API Endpoint Specification

To communicate directly with the dashboard, the ESP32 must run a local HTTP server and expose the following endpoints:

### GET `/data`
Fetches the current real-time sensor measurements and system states.
* **CORS Requirement:** Must include the header `Access-Control-Allow-Origin: *`.
* **Content-Type:** `application/json`
* **Response Body Format:**
```json
{
  "gas": 120,
  "flame": 0,
  "vibration": 0,
  "door": "Locked",
  "wifi": "Connected",
  "ip": "192.168.1.100"
}
```

### GET `/door?state=<Locked|Unlocked>`
Receives a lock/unlock command from the dashboard (e.g. when entering the correct PIN on the keypad).
* **CORS Requirement:** Must include the header `Access-Control-Allow-Origin: *`.
* **Action:** 
  - If state is `Unlocked`: Sweeps the physical servo motor to `90°` and updates internal state.
  - If state is `Locked`: Sweeps the physical servo motor to `0°` and updates internal state.
* **Response Body Format:** A simple text confirmation (e.g., `OK`) or a status JSON.

---

## 3. Complete ESP32 Firmware Sketch
Below is a complete, ready-to-flash Arduino C++ sketch utilizing the standard Arduino libraries to run a non-blocking web server on the ESP32.

```cpp
#include <WiFi.h>
#include <WebServer.h>
#include <Keypad.h>
#include <ESP32Servo.h>

// -------- WIFI CONFIGURATION --------
const char* ssid = "Your_WiFi_Name";
const char* password = "Your_WiFi_Password";

// -------- HARDWARE PINS --------
#define MQ2_PIN    32
#define FLAME_PIN  34
#define VIB_PIN    25
#define SERVO_PIN  18

// -------- KEYPAD LAYOUT --------
const byte ROWS = 4;
const byte COLS = 4;
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rowPins[ROWS] = {4, 5, 19, 21};
byte colPins[COLS] = {22, 23, 27, 14};

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

// -------- SYSTEM STATE --------
String correctPin = "9608";
String keypadInput = "";
bool isDoorLocked = true;
unsigned long unlockTime = 0;
const unsigned long AUTO_LOCK_DELAY = 2000; // Auto-relock after 2 seconds

Servo myServo;
WebServer server(80);

// -------- HELPER FUNCTION: SEND JSON DATA --------
void handleDataEndpoint() {
  // Read current sensor values
  int gasRaw = analogRead(MQ2_PIN);
  
  // Convert 12-bit analog input (0-4095) to estimated PPM range (50-900)
  // Adjust this scaling logic to calibrate with your specific MQ2 sensor
  float gasPPM = 50.0 + ((float)gasRaw / 4095.0) * 850.0;
  if (gasPPM > 900.0) gasPPM = 900.0;
  
  // Flame: digital read (LOW means fire detected on standard active-low sensors)
  int flameVal = (digitalRead(FLAME_PIN) == LOW) ? 1 : 0;
  
  // Vibration: digital read (HIGH means vibration/intrusion detected)
  int vibeVal = (digitalRead(VIB_PIN) == HIGH) ? 1 : 0;
  
  String doorStatus = isDoorLocked ? "Locked" : "Unlocked";
  
  // Construct JSON response
  String json = "{";
  json += "\"gas\":" + String(gasPPM, 0) + ",";
  json += "\"flame\":" + String(flameVal) + ",";
  json += "\"vibration\":" + String(vibeVal) + ",";
  json += "\"door\":\"" + doorStatus + "\",";
  json += "\"wifi\":\"Connected\",";
  json += "\"ip\":\"" + WiFi.localIP().toString() + "\"";
  json += "}";
  
  // Crucial: Add CORS Headers so the browser dashboard can fetch data directly
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
}

// -------- HELPER FUNCTION: DOOR CONTROL --------
void handleDoorControl() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  if (server.hasArg("state")) {
    String stateArg = server.arg("state");
    if (stateArg == "Unlocked") {
      isDoorLocked = false;
      myServo.write(90); // Unlock position
      unlockTime = millis(); // Reset auto-lock timer
      Serial.println("[API] Access Granted. Door Unlocked.");
      server.send(200, "text/plain", "Door Unlocked");
      return;
    } else if (stateArg == "Locked") {
      isDoorLocked = true;
      myServo.write(0); // Locked position
      Serial.println("[API] Door Locked.");
      server.send(200, "text/plain", "Door Locked");
      return;
    }
  }
  server.send(400, "text/plain", "Invalid Request Parameters");
}

// -------- SETUP --------
void setup() {
  Serial.begin(115200);
  
  pinMode(FLAME_PIN, INPUT);
  pinMode(VIB_PIN, INPUT);
  
  myServo.attach(SERVO_PIN);
  myServo.write(0); // Start Locked
  
  // Connect to Wi-Fi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to Wi-Fi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi Connected!");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());
  
  // Bind web server paths
  server.on("/data", HTTP_GET, handleDataEndpoint);
  server.on("/door", HTTP_GET, handleDoorControl);
  
  // Enable CORS pre-flight support
  server.on("/door", HTTP_OPTIONS, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    server.send(204);
  });
  
  server.begin();
  Serial.println("HTTP Web Server Started.");
}

// -------- LOOP --------
void loop() {
  server.handleClient();
  
  // -------- PHYSICAL KEYPAD ACCESS CONTROL --------
  char key = keypad.getKey();
  if (key) {
    Serial.print("Keypad Key Pressed: ");
    Serial.println(key);
    
    if (key != '#') {
      keypadInput += key;
    } else {
      if (keypadInput == correctPin) {
        Serial.println("Physical Access Granted.");
        isDoorLocked = false;
        myServo.write(90); // Open Servo
        unlockTime = millis(); // Start auto-relock timer
      } else {
        Serial.println("Physical Access Denied: Incorrect PIN.");
      }
      keypadInput = ""; // Clear buffer
    }
  }
  
  // -------- AUTO-RELOCK TIMER --------
  if (!isDoorLocked && (millis() - unlockTime >= AUTO_LOCK_DELAY)) {
    isDoorLocked = true;
    myServo.write(0); // Close Servo
    Serial.println("Lock automatically secured.");
  }
}
```

---

## 4. Connecting the Dashboard
1. Flash the ESP32 with the firmware above and monitor the Arduino Serial Console to get the device's IP Address (e.g. `192.168.1.100`).
2. Open the Dashboard `index.html` in your web browser.
3. Click **"Configure ESP32"** in the top-left connectivity panel.
4. Input your ESP32's IP Address and click **"Save Configuration"**.
5. The dashboard will automatically begin polling your device every `1s` and update sensor statuses, alarm systems, logs, and graphs in real time.
