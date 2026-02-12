window.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const maxPoints = 30;

  let minPower = sessionStorage.getItem("minPower")
    ? parseFloat(sessionStorage.getItem("minPower"))
    : Infinity;

  let maxPower = sessionStorage.getItem("maxPower")
    ? parseFloat(sessionStorage.getItem("maxPower"))
    : 0;

  // Make sure we only start the power polling once per page load
  let powerPoller = null;

  // Restore min/max power UI if we have saved values
  const minPowerEl = document.getElementById("minPower");
  const maxPowerEl = document.getElementById("maxPower");

  if (minPowerEl && minPower !== Infinity) minPowerEl.textContent = minPower.toFixed(3);
  if (maxPowerEl && maxPower !== 0) maxPowerEl.textContent = maxPower.toFixed(3);

  const chartConfig = (label, color) => ({
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: String(label),
        data: [],
        fill: false,
        borderColor: String(color),
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      animation: false,
      scales: {
        x: { display: false },
        y: { beginAtZero: true }
      },
      plugins: {
        legend: {
          labels: {
            font: { size: 12 }
          }
        }
      }
    }
  });

  const cpuChart = new Chart(document.getElementById("cpuChart"), chartConfig("CPU Usage (%)", "#0d6efd"));
  const memChart = new Chart(document.getElementById("memChart"), chartConfig("Memory Usage (%)", "#6610f2"));
  const tempChart = new Chart(document.getElementById("tempChart"), chartConfig("TEMP TEST CPU Temp (\u00B0C)", "#dc3545"));
  const fanChart  = new Chart(document.getElementById("fanChart"), chartConfig("Fan Speed (RPM)", "#0dcaf0"));
  const freqChart = new Chart(document.getElementById("freqChart"), chartConfig("CPU Frequency (MHz)", "#f39c12"));
  const gpuFreqChart = new Chart(document.getElementById("gpuFreqChart"), chartConfig("GPU Frequency (MHz)", "#fd7e14"));
  const diskChart = new Chart(document.getElementById("diskChart"), chartConfig("Disk Usage (%)", "#6f42c1"));

  const diskIOChart = new Chart(document.getElementById("diskIOChart"), {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "Read MB/s",  data: [], borderColor: "#20c997", fill: false, tension: 0.3, pointRadius: 0, borderWidth: 2 },
        { label: "Write MB/s", data: [], borderColor: "#d63384", fill: false, tension: 0.3, pointRadius: 0, borderWidth: 2 }
      ]
    },
    options: {
      responsive: true,
      animation: false,
      scales: { x: { display: false }, y: { beginAtZero: true } },
      plugins: { legend: { labels: { font: { size: 12 } } } }
    }
  });

  const netIOChart = new Chart(document.getElementById("netIOChart"), {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "Recv MB/s", data: [], borderColor: "#0dcaf0", fill: false, tension: 0.3, pointRadius: 0, borderWidth: 2 },
        { label: "Send MB/s", data: [], borderColor: "#ffc107", fill: false, tension: 0.3, pointRadius: 0, borderWidth: 2 }
      ]
    },
    options: {
      responsive: true,
      animation: false,
      scales: { x: { display: false }, y: { beginAtZero: true } },
      plugins: { legend: { labels: { font: { size: 12 } } } }
    }
  });

  const powerChart = new Chart(document.getElementById("powerChart"), {
    type: "bar",
    data: {
      labels: [],
      datasets: [{
        label: "Power (W)",
        data: [],
        backgroundColor: "rgba(13, 202, 240, 0.6)",
        borderColor: "rgba(13, 202, 240, 1)",
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { color: "#aaa" }, grid: { color: "#333" } },
        x: { ticks: { color: "#aaa" }, grid: { display: false } }
      },
      plugins: {
        legend: { labels: { font: { size: 12 }, color: "#ccc" } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw.toFixed(3)} W` } }
      }
    }
  });

  // -------- Power polling (START ONCE) --------
  async function updatePowerChart() {
    try {
      const res = await fetch("/api/power");
      const data = await res.json();

      if (!data || !data.readings) return;

      powerChart.data.labels = data.readings.map(r => r.rail);
      powerChart.data.datasets[0].data = data.readings.map(r => r.power);
      powerChart.update();

      const totalPowerEl = document.getElementById("totalPowerStat");
      if (totalPowerEl && typeof data.total_power === "number") {
        totalPowerEl.textContent = `${data.total_power.toFixed(3)} W`;
      }

      if (typeof data.total_power === "number") {
        if (data.total_power < minPower) {
          minPower = data.total_power;
          sessionStorage.setItem("minPower", String(minPower));
        }
        if (data.total_power > maxPower) {
          maxPower = data.total_power;
          sessionStorage.setItem("maxPower", String(maxPower));
        }
      }

      if (minPowerEl && minPower !== Infinity) minPowerEl.textContent = minPower.toFixed(3);
      if (maxPowerEl && maxPower !== 0) maxPowerEl.textContent = maxPower.toFixed(3);

    } catch (err) {
      console.error("Power chart fetch failed:", err);
    }
  }

  // Start the poller once per page load
  setTimeout(() => {
    updatePowerChart();
    if (!powerPoller) powerPoller = setInterval(updatePowerChart, 2000);
  }, 500);

  // -------- Helpers for charts --------
  const updateChart = (chart, label, value) => {
    if (!chart || !chart.data) return;

    if (chart.data.labels.length > maxPoints) {
      chart.data.labels.shift();
      chart.data.datasets.forEach(ds => ds.data.shift());
    }
    chart.data.labels.push(label);
    chart.data.datasets[0].data.push(value);
    chart.update();
  };

  const pushToChart = (chart, datasetIndex, value, label = null) => {
    if (!chart || !chart.data) return;

    if (label !== null) {
      chart.data.labels.push(label);
    } else if (chart.data.labels.length < chart.data.datasets[datasetIndex].data.length + 1) {
      chart.data.labels.push("");
    }

    chart.data.datasets[datasetIndex].data.push(value);

    if (chart.data.labels.length > maxPoints) {
      chart.data.labels.shift();
      chart.data.datasets.forEach(ds => ds.data.shift());
    }

    chart.update();
  };

  // -------- Socket updates --------
  socket.on("update", (stats) => {
    const now = new Date().toLocaleTimeString();

    // Update single-series charts
    updateChart(cpuChart, now, stats.cpu);
    updateChart(memChart, now, stats.memory_percent);
    updateChart(tempChart, now, stats.temp);
    updateChart(fanChart, now, stats.fan_rpm);
    updateChart(freqChart, now, stats.cpu_freq);
    updateChart(gpuFreqChart, now, stats.gpu_freq);
    updateChart(diskChart, now, stats.disk_usage_percent);

    // Update multi-series charts
    pushToChart(diskIOChart, 0, stats.disk_read_mb_s, now);
    pushToChart(diskIOChart, 1, stats.disk_write_mb_s);

    pushToChart(netIOChart, 0, stats.net_recv_mb_s, now);
    pushToChart(netIOChart, 1, stats.net_sent_mb_s);

    // Floating stats
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText("cpuStat", `${(stats.cpu * 100).toFixed(1)}%`);
    setText("memStat", `${(stats.memory_percent * 100).toFixed(1)}%`);
    setText("tempStat", `${stats.temp.toFixed(1)}\u00B0C`);
    setText("fanSpeedLabel", `${stats.fan_rpm} RPM`);
    setText("freqStat", `${stats.cpu_freq.toFixed(0)} MHz`);
    setText("gpuFreqStat", `${stats.gpu_freq.toFixed(0)} MHz`);
    setText("diskStat", `${(stats.disk_usage_percent * 100).toFixed(1)}%`);
    setText("diskReadStat", `${stats.disk_read_mb_s.toFixed(1)} MB/s`);
    setText("diskWriteStat", `${stats.disk_write_mb_s.toFixed(1)} MB/s`);
    setText("netRecvStat", `${stats.net_recv_mb_s.toFixed(1)} MB/s`);
    setText("netSentStat", `${stats.net_sent_mb_s.toFixed(1)} MB/s`);

    // Footer
    setText("uptime", stats.uptime_human);
    setText("loadAvg", stats.load_avg);

    const cpuPressureEl = document.getElementById("cpuPressure");
	const cpuPressureLabelEl = document.getElementById("cpuPressureLabel");

if (cpuPressureEl && cpuPressureLabelEl) {
  if (stats.cpu_pressure_1m !== undefined && stats.cpu_pressure_1m !== null) {

    const p = Number(stats.cpu_pressure_1m);
    cpuPressureEl.textContent = `${p.toFixed(1)}%`;
    cpuPressureEl.style.fontWeight = "bold";

    // Reset badge class
    cpuPressureLabelEl.className = "badge ms-2";

    if (p < 70) {
      cpuPressureEl.style.color = "#0dcaf0";
      cpuPressureLabelEl.textContent = "OK";
      cpuPressureLabelEl.classList.add("bg-info");
    } 
    else if (p < 100) {
      cpuPressureEl.style.color = "#ffc107";
      cpuPressureLabelEl.textContent = "BUSY";
      cpuPressureLabelEl.classList.add("bg-warning");
    } 
    else {
      cpuPressureEl.style.color = "#dc3545";
      cpuPressureLabelEl.textContent = "OVERLOADED";
      cpuPressureLabelEl.classList.add("bg-danger");
    }

  } else {
    cpuPressureEl.textContent = "--%";
    cpuPressureEl.style.color = "#ccc";

    cpuPressureLabelEl.textContent = "—";
    cpuPressureLabelEl.className = "badge bg-secondary ms-2";
  }
}
  });
});
