import eventlet
import psutil
import time
import os
import subprocess

eventlet.monkey_patch()

from flask import Flask, render_template, jsonify
from flask_compress import Compress
from flask_socketio import SocketIO

app = Flask(__name__)
Compress(app)

socketio = SocketIO(app)

def get_uptime():
    uptime_seconds = time.time() - psutil.boot_time()
    minutes, seconds = divmod(int(uptime_seconds), 60)
    hours, minutes = divmod(minutes, 60)
    days, hours = divmod(hours, 24)
    return f"{days}d {hours}h {minutes}m"

def get_gpu_freq():
    try:
        output = subprocess.check_output(["vcgencmd", "measure_clock", "core"]).decode()
        return int(output.split("=")[-1].strip()) // 1000000  # Convert Hz to MHz
    except Exception:
        return 0

def get_disk_io():
    try:
        disk_io_1 = psutil.disk_io_counters()
        time.sleep(1)
        disk_io_2 = psutil.disk_io_counters()
        read_mb_s = (disk_io_2.read_bytes - disk_io_1.read_bytes) / (1024 * 1024)
        write_mb_s = (disk_io_2.write_bytes - disk_io_1.write_bytes) / (1024 * 1024)
        return read_mb_s, write_mb_s
    except Exception:
        return 0, 0

def get_network_io():
    try:
        net_io_1 = psutil.net_io_counters()
        time.sleep(1)
        net_io_2 = psutil.net_io_counters()
        recv_mb_s = (net_io_2.bytes_recv - net_io_1.bytes_recv) / (1024 * 1024)
        sent_mb_s = (net_io_2.bytes_sent - net_io_1.bytes_sent) / (1024 * 1024)
        return recv_mb_s, sent_mb_s
    except Exception:
        return 0, 0  

def get_stats():
    fan_rpm = 0
    try:
        hwmon_base = "/sys/class/hwmon"
        for entry in os.listdir(hwmon_base):
            name_path = os.path.join(hwmon_base, entry, "name")
            if os.path.isfile(name_path):
                with open(name_path, "r") as f:
                    if f.read().strip() == "pwmfan":
                        fan_path = os.path.join(hwmon_base, entry, "fan1_input")
                        with open(fan_path, "r") as fan_file:
                            fan_rpm = int(fan_file.read().strip())
                        break
    except (FileNotFoundError, ValueError, OSError):
        fan_rpm = 0

        cpu_freq = 0
    try:
        cpu_freq = psutil.cpu_freq().current
    except Exception:
        cpu_freq = 0

    disk_usage_percent = psutil.disk_usage("/").percent / 100
    read_mb_s, write_mb_s = get_disk_io()
    recv_mb_s, sent_mb_s = get_network_io()

    # Load averages (1m, 5m, 15m)
    load1, load5, load15 = os.getloadavg()
    cores = os.cpu_count() or 1

    cpu_pressure_1m = (load1 / cores) * 100.0
    cpu_pressure_5m = (load5 / cores) * 100.0
    cpu_pressure_15m = (load15 / cores) * 100.0

    return {
        "cpu": psutil.cpu_percent() / 100,
        "memory_percent": psutil.virtual_memory().percent / 100,
        "temp": psutil.sensors_temperatures().get("cpu_thermal", [])[0].current if "cpu_thermal" in psutil.sensors_temperatures() else 0,
        "uptime_human": get_uptime(),
        "load_avg": f"{load1:.2f}, {load5:.2f}, {load15:.2f}",
        "cpu_cores": cores,
        "cpu_pressure_1m": round(cpu_pressure_1m, 1),
        "cpu_pressure_5m": round(cpu_pressure_5m, 1),
        "cpu_pressure_15m": round(cpu_pressure_15m, 1),
        "fan_rpm": fan_rpm,
        "cpu_freq": cpu_freq,
        "disk_usage_percent": disk_usage_percent,
        "gpu_freq": get_gpu_freq(),
        "disk_read_mb_s": read_mb_s,
        "disk_write_mb_s": write_mb_s,
        "net_recv_mb_s": recv_mb_s,
        "net_sent_mb_s": sent_mb_s
    }

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/power")
def power_api():
    try:
        rails = [
            ("3V7_WL_SW", 0, 8),
            ("3V3_SYS", 1, 9),
            ("1V8_SYS", 2, 10),
            ("DDR_VDD2", 3, 11),
            ("DDR_VDDQ", 4, 12),
            ("1V1_SYS", 5, 13),
            ("0V8_SW", 6, 14),
            ("VDD_CORE", 7, 15),
            ("0V8_AON", 16, 19),
            ("3V3_DAC", 17, 20),
            ("3V3_ADC", 18, 21),
            ("HDMI", 22, 23)
        ]

        def read_pmic_channel(channel, unit):
            try:
                output = subprocess.check_output(["vcgencmd", "pmic_read_adc", f"CH{channel}"]).decode()
                for line in output.strip().splitlines():
                    if unit in line and f"({channel})" in line:
                        return float(line.split("=")[1].replace(unit, "").strip())
            except Exception as e:
                print(f"[PMIC DEBUG] Failed to read CH{channel}: {e}")
            return None


        readings = []
        total_power = 0.0

        for name, ch_current, ch_voltage in rails:
            current = read_pmic_channel(ch_current, "A")
            voltage = read_pmic_channel(ch_voltage, "V")

            if current is not None and voltage is not None:
                power = voltage * current
                readings.append({
                    "rail": name,
                    "voltage": round(voltage, 3),
                    "current": round(current, 3),
                    "power": round(power, 3)
                })
                total_power += power

        return jsonify({
            "total_power": round(total_power, 3),
            "readings": readings
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

def emit_stats():
    while True:
        stats = get_stats()
        socketio.emit("update", stats)
        socketio.sleep(1)

@socketio.on("connect")
def handle_connect():
    print("Client connected")

if __name__ == "__main__":
    socketio.start_background_task(emit_stats)
    socketio.run(app, host="0.0.0.0", port=5000)
