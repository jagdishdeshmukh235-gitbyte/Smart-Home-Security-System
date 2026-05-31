**Smart Home Security System using ESP32 and IoT**
# Overview

The Smart Home Security System is an IoT-based security solution developed using ESP32. The system continuously monitors gas leakage, fire hazards, and intrusion activities using multiple sensors and provides real-time monitoring through a web-based dashboard. It also includes a password-protected smart door lock using a 4×4 keypad and SG90 servo motor.

The project aims to improve home security, safety, and automation by combining IoT technology, sensor monitoring, and access control into a single integrated system.

# Objectives
Detect gas leakage using MQ2 Gas Sensor.
Detect fire using Flame Sensor.
Detect unauthorized access using Vibration Sensor.
Provide password-based door access control.
Display real-time sensor data on a web dashboard.
Improve home safety and security.
Develop a low-cost and efficient IoT security solution.

# Features

Real-time Gas Monitoring,
 Fire Detection System,
 Intrusion Detection,
 Password-Based Door Lock,
 Servo Motor Controlled Access,
 ESP32 Web Server Dashboard,
 Wi-Fi Connectivity,
 Automatic Door Locking,
 Low Cost & Easy Installation,

# Hardware Components
Component	Quantity
ESP32 Development Board	1
MQ2 Gas Sensor	1
Flame Sensor	1
Vibration Sensor	1
4×4 Keypad	1
SG90 Servo Motor	1
7805 Voltage Regulator	1
9V Battery	1
Breadboard	1
Jumper Wires	As Required

# Software Components
Arduino IDE
ESP32 Board Package
Web Server
HTML
CSS
JavaScript
ESP32Servo Library
Keypad Library
WiFi Library

# Pin Connections
MQ2 Gas Sensor
MQ2 Pin	ESP32 Pin
VCC	5V
GND	GND
AO	GPIO32
Flame Sensor
Flame Sensor Pin	ESP32 Pin
VCC	3.3V
GND	GND
DO	GPIO34
Vibration Sensor
Vibration Sensor Pin	ESP32 Pin
VCC	3.3V
GND	GND
DO	GPIO25
Servo Motor (SG90)
Servo Wire	ESP32
Signal	GPIO18
VCC	External 5V
GND	Common GND
4×4 Keypad
Keypad Pin	ESP32 Pin
R1	GPIO4
R2	GPIO5
R3	GPIO19
R4	GPIO21
C1	GPIO22
C2	GPIO23
C3	GPIO27
C4	GPIO14

# Working Principle
ESP32 continuously reads data from all connected sensors.
MQ2 sensor detects gas leakage and smoke.
Flame sensor detects fire.
Vibration sensor detects intrusion or window breaking.
Sensor data is processed by ESP32.
Real-time data is displayed on the web dashboard.
User enters a password through the keypad.
If the password is correct, the servo motor unlocks the door.
After a predefined time, the door automatically locks again.
The system continuously monitors the environment for security threats.

# Web Dashboard

The project includes a responsive web dashboard that displays:

Gas Sensor Status
Fire Detection Status
Intrusion Detection Status
Door Lock Status
ESP32 Connection Status
Real-Time Sensor Values

# Block Diagram
MQ2 Gas Sensor
       │
Flame Sensor
       │
Vibration Sensor
       │
      ESP32
       │
 ┌─────┴─────┐
 │           │
Web Dashboard  Servo Motor
                 │
              Door Lock
# Advantages
Real-time Monitoring
Enhanced Security
Early Hazard Detection
Password-Based Access Control
Cost-Effective Solution
Easy Installation
Automatic Operation
Expandable Architecture

# Limitations
Requires Stable Power Supply
Depends on Wi-Fi Connectivity
Limited Sensor Range
Possibility of False Alarms
Requires Periodic Maintenance

# Future Scope
Face Recognition Access System
Camera Surveillance Integration
AI-Based Threat Detection
Cloud Data Storage
Mobile Application Development
Voice Assistant Integration
Backup Power System
Smart Home Automation Features

# Applications
Smart Homes
Residential Apartments
Offices and Commercial Buildings
Industries
Warehouses
Laboratories
Educational Institutions
Hospitals
Smart Buildings

# Conclusion

The Smart Home Security System using ESP32 and IoT provides a reliable, low-cost, and efficient solution for modern security requirements. The system integrates gas detection, fire detection, intrusion monitoring, and password-based access control into a single platform. By utilizing ESP32, sensors, and a web-based dashboard, the project offers real-time monitoring, improved safety, and enhanced security for residential and commercial environments.

# Developed By

Jagdish Shivsambha Deshmukh
Department of Electronics & Communication (ACT)
CSMSS Chh. Shahu College of Engineering, Chhatrapati Sambhajinagar

📜 License

This project is developed for educational and academic purposes.
