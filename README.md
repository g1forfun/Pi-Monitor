![Python](https://img.shields.io/badge/python-3.9+-blue.svg)
![Flask](https://img.shields.io/badge/Flask-app-lightgrey)
[![GitHub stars](https://img.shields.io/github/stars/g1forfun/Pi-Monitor?style=social)](https://github.com/g1forfun/Pi-Monitor/stargazers)

# 🖥️ Pi 5 Performance Dashboard
⭐️ If you like this project, give it a star!

A real-time system monitoring dashboard built for the Raspberry Pi 5, using **Flask**, **Socket.IO**, and **Chart.js**. Tracks key performance metrics including CPU usage, memory, temperature, fan speed, network I/O, disk activity, and PMIC power draw — all in a sleek, dark-themed UI.
All you need for Raspberry Pi 5 monitoring.

---

## 📸 Screenshot
![Image](https://github.com/user-attachments/assets/39701724-cd86-4025-8676-d90e1f1b3896)

---

## 🚀 Features

- Live-updating charts for:
  - CPU usage (%)
  - Memory usage (%)
  - CPU temperature
  - CPU and GPU frequency
  - Fan Speed (RPM)
  - Disk usage (%)
  - Disk I/O (MB/s)
  - Network I/O (MB/s)
  - PMIC power draw (W)
- Auto-min/max tracking for power
- Socket.IO WebSocket updates
- Bootstrap 5 + dark mode styling
- Optional floating stat indicators
- CPU Pressure (%) normalized to 1-minute load based on core count
- Dynamic CPU load status badge (OK / BUSY / OVERLOADED)
  
---

## 📦 Requirements

- Python 3.7+
- Raspberry Pi 5
- Flask
- `psutil` and related system tools
- (Optional) `vcgencmd`, `zramctl`, or any sensors you want to add

---

⚙️ Lightweight by Design
This dashboard is built with efficiency in mind:

RAM Usage: Typically under 100MB total, including the Python runtime, Flask server, and WebSocket background updates.

CPU Impact: Negligible — system stats are fetched periodically with lightweight tools like psutil, avoiding constant polling or heavy shell loops.

Zero bloat: No heavy frameworks or services — just HTML, Bootstrap, Chart.js, and a minimal Flask backend.

Headless-optimized: Ideal for headless Raspberry Pi boards, even those with limited memory.

Self-cleaning: No background daemons, logs, or databases to maintain. All data is stored in memory and automatically resets on reboot.

The goal of this project is to provide a visually modern and extensible dashboard that stays well within the performance envelope of even a 2GB Pi board — while being easy to expand for custom use cases like Pi-hole stats, power monitoring, or even LLM integrations.

## 🛠️ Installation

```bash
# Connect to your PI so that you can issue commands
SSH to Pi if using another device on your netowrk (like a PC) or remote into Pi and use local terminal

# Clone the repo (Pi-Monitor directory will be created in the current directory the command is being ran from)
git clone https://github.com/g1forfun/Pi-Monitor.git
cd Pi-Monitor

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run it
python app.py

# Access the Web Dashboard
In your browser http://<Your PI's IP>:5000
