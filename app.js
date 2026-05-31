// STATE STATE MANAGEMENT
let state = {
    esp32Ip: '172.22.25.88',
    sensors: {
        gas: 120, // PPM
        flame: 0, // 0 = Safe, 1 = Fire Detected
        vibration: 0 // 0 = Safe, 1 = Intruder Detected
    },
    door: {
        locked: true,
        servoAngle: 0, // 0 or 90 degrees
        passcodeBuffer: '',
        correctPasscode: '9608'
    },
    stats: {
        totalAlerts: 0,
        gasEvents: 0,
        fireEvents: 0,
        intrusionEvents: 0
    },
    soundEnabled: true,
    lastUpdated: new Date()
};

// CHART VARIABLES
let gasChart = null;
let activityChart = null;
const MAX_CHART_POINTS = 15;
let gasChartData = [];
let gasChartLabels = [];

// POLLING INTERVAL ID & OFFLINE LOG THROTTLE
let esp32PollInterval = null;
let isLastConnectionOk = true;

// SELECT DOM ELEMENTS
const elTime = document.getElementById('current-time');
const elDate = document.getElementById('current-date');
const elSystemStatusBadge = document.getElementById('system-status-badge');
const elEsp32Status = document.getElementById('esp32-status');
const elEsp32IpDisplay = document.getElementById('esp32-ip-display');
const elWifiStatusText = document.getElementById('wifi-status-text');
const elWifiBars = document.getElementById('wifi-bars');
const elLastUpdated = document.getElementById('last-updated');

// Modal elements
const elBtnConfigEsp32 = document.getElementById('btn-config-esp32');
const elEsp32Modal = document.getElementById('esp32-modal');
const elEsp32ConfigForm = document.getElementById('esp32-config-form');
const elBtnModalClose = document.getElementById('btn-modal-close');
const elBtnModalCancel = document.getElementById('btn-modal-cancel');

// MQ2 Card
const elCardMq2 = document.getElementById('card-mq2');
const elMq2Badge = document.getElementById('mq2-badge');
const elMq2Value = document.getElementById('mq2-value');
const elMq2StatusText = document.getElementById('mq2-status-text');
const elMq2GaugeFill = document.getElementById('mq2-gauge-fill');

// Flame Card
const elCardFlame = document.getElementById('card-flame');
const elFlameBadge = document.getElementById('flame-badge');
const elFlameWrapper = document.getElementById('flame-wrapper');
const elFlameStatusText = document.getElementById('flame-status-text');

// Vibration Card
const elCardVibration = document.getElementById('card-vibration');
const elVibrationBadge = document.getElementById('vibration-badge');
const elVibrationWrapper = document.getElementById('vibration-wrapper');
const elVibrationStatusText = document.getElementById('vibration-status-text');

// Door Lock Card
const elDoorBadge = document.getElementById('door-badge');
const elDoorLockStatus = document.getElementById('door-lock-status');
const elDoorServoStatus = document.getElementById('door-servo-status');
const elDoorLastAuth = document.getElementById('door-last-auth');
const elServoHand = document.getElementById('servo-hand');
const elServoAngle = document.getElementById('servo-angle');
const elMainLockIcon = document.getElementById('main-lock-icon');
const elLockGraphic = document.getElementById('lock-graphic');
const elDoorLockContainer = document.querySelector('.door-lock-container');

// Keypad
const elKeypadDisplay = document.getElementById('keypad-display');
const elBtnKeys = document.querySelectorAll('.btn-key');

// Stats Counters
const elStatTotal = document.getElementById('stat-val-total');
const elStatGas = document.getElementById('stat-val-gas');
const elStatFire = document.getElementById('stat-val-fire');
const elStatVibe = document.getElementById('stat-val-vibe');

// Logs & Audios
const elLogsContainer = document.getElementById('logs-container');
const elLogEmptyMsg = document.getElementById('log-empty-msg');
const elBtnSoundToggle = document.getElementById('btn-sound-toggle');
const elSoundIcon = document.getElementById('sound-icon');
const audioChime = document.getElementById('alert-chime');
const audioSiren = document.getElementById('alert-siren');

// INITIALIZATION
window.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // Start Live Clock
    updateClock();
    setInterval(updateClock, 1000);

    // Load credentials from local storage if any
    loadEsp32Config();

    // Set Up Charts
    initCharts();

    // Bind Event Listeners
    setupEventListeners();

    // Log System Init
    logEvent("System initialized. Direct ESP32 integration active.", "safe");

    // Start Polling Loop
    startESP32Polling();
});

// CLOCK FUNCTION
function updateClock() {
    const now = new Date();
    elTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    elDate.textContent = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    // Update last updated ticker
    const elapsedSecs = Math.floor((now - state.lastUpdated) / 1000);
    if (elapsedSecs < 5) {
        elLastUpdated.textContent = "Just Now";
    } else if (elapsedSecs < 60) {
        elLastUpdated.textContent = `${elapsedSecs}s ago`;
    } else {
        const mins = Math.floor(elapsedSecs / 60);
        elLastUpdated.textContent = `${mins}m ago`;
    }
}

// SETUP EVENT LISTENERS
function setupEventListeners() {
    // Modal buttons
    elBtnConfigEsp32.addEventListener('click', openEsp32Modal);
    elBtnModalClose.addEventListener('click', closeEsp32Modal);
    elBtnModalCancel.addEventListener('click', closeEsp32Modal);
    elEsp32ConfigForm.addEventListener('submit', saveEsp32Config);

    // Keypad Click Event
    elBtnKeys.forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.getAttribute('data-val');
            handleKeypadInput(val);
        });
    });

    // Sound toggle
    elBtnSoundToggle.addEventListener('click', toggleSound);

    // Logs clearing
    document.getElementById('btn-clear-logs').addEventListener('click', clearLogs);
}

// SOUND MANAGEMENT
function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    const soundIcon = document.getElementById('sound-icon');
    if (state.soundEnabled) {
        if (soundIcon) soundIcon.setAttribute('data-lucide', 'volume-2');
        elBtnSoundToggle.classList.remove('btn-icon-danger');
        elBtnSoundToggle.classList.add('btn-icon');
    } else {
        if (soundIcon) soundIcon.setAttribute('data-lucide', 'volume-x');
        elBtnSoundToggle.classList.remove('btn-icon');
        elBtnSoundToggle.classList.add('btn-icon-danger');
        // Stop any looping siren immediately
        audioSiren.pause();
        audioSiren.currentTime = 0;
    }
    lucide.createIcons();
}

function playSound(type) {
    if (!state.soundEnabled) return;

    try {
        if (type === 'chime') {
            audioChime.volume = 0.5;
            audioChime.play().catch(e => console.log("Audio play blocked by browser."));
        } else if (type === 'siren') {
            audioSiren.volume = 0.4;
            audioSiren.play().catch(e => console.log("Audio play blocked by browser."));
        } else if (type === 'stop-siren') {
            audioSiren.pause();
            audioSiren.currentTime = 0;
        }
    } catch (err) {
        console.warn("Sound playback error:", err);
    }
}

// ESP32 CONFIG MODAL FUNCTIONS
function openEsp32Modal() {
    document.getElementById('esp32-ip-address').value = state.esp32Ip;
    elEsp32Modal.classList.add('active');
}

function closeEsp32Modal() {
    elEsp32Modal.classList.remove('active');
}

function saveEsp32Config(e) {
    e.preventDefault();
    const newIp = document.getElementById('esp32-ip-address').value.trim();
    if (newIp) {
        state.esp32Ip = newIp;
        localStorage.setItem('esp32_ip', newIp);
        elEsp32IpDisplay.textContent = newIp;
        logEvent(`ESP32 IP configured: ${newIp}`, "safe");
        closeEsp32Modal();
        startESP32Polling();
    }
}

function loadEsp32Config() {
    const savedIp = localStorage.getItem('esp32_ip');
    if (savedIp) {
        state.esp32Ip = savedIp;
    }
    elEsp32IpDisplay.textContent = state.esp32Ip;
}

// ESP32 POLLING SYSTEM
function startESP32Polling() {
    if (esp32PollInterval) {
        clearInterval(esp32PollInterval);
    }

    fetchESP32Data();
    esp32PollInterval = setInterval(fetchESP32Data, 1000);
}

function stopESP32Polling() {
    if (esp32PollInterval) {
        clearInterval(esp32PollInterval);
        esp32PollInterval = null;
    }
}

async function fetchESP32Data() {
    const ip = state.esp32Ip;
    if (!ip) {
        updateConnectionStatus(false);
        return;
    }

    const url = `http://${ip}/data`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 900);

        const response = await fetch(url, {
            signal: controller.signal,
            mode: 'cors'
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP status: ${response.status}`);
        }

        const data = await response.json();

        updateConnectionStatus(true, data.ip || ip, data.wifi);

        // Parse and update sensor data
        const gasVal = parseFloat(data.gas) !== undefined ? parseFloat(data.gas) : state.sensors.gas;
        const flameVal = parseInt(data.flame) !== undefined ? parseInt(data.flame) : state.sensors.flame;
        const vibrationVal = parseInt(data.vibration) !== undefined ? parseInt(data.vibration) : state.sensors.vibration;
        const doorVal = data.door || (state.door.locked ? "Locked" : "Unlocked");

        state.lastUpdated = new Date();

        updateGasSensor(gasVal);
        updateFlameSensor(flameVal);
        updateVibrationSensor(vibrationVal);
        updateDoorLockFromESP32(doorVal);

    } catch (error) {
        console.error("ESP32 Communication Error: ", error);
        updateConnectionStatus(false);
        playSound('stop-siren');
    }
}

function updateConnectionStatus(isOnline, ip = '', wifiStatus = '') {
    if (isOnline) {
        elEsp32Status.textContent = "Online";
        elEsp32Status.className = "value val-status text-green";

        elEsp32IpDisplay.textContent = ip || state.esp32Ip;

        const isWifiConnected = (wifiStatus === "Connected");
        elWifiStatusText.textContent = isWifiConnected ? "Connected" : "Disconnected";
        elWifiStatusText.className = isWifiConnected ? "value text-green" : "value text-red";
        updateWifiBars(isWifiConnected);

        elSystemStatusBadge.textContent = "System Online";
        elSystemStatusBadge.className = "status-text";
        document.querySelector('.status-indicator').className = "status-indicator online";

        if (!isLastConnectionOk) {
            logEvent("ESP32 network connection restored.", "safe");
            isLastConnectionOk = true;
        }
    } else {
        elEsp32Status.textContent = "Offline";
        elEsp32Status.className = "value val-status text-red";

        elWifiStatusText.textContent = "Offline";
        elWifiStatusText.className = "value text-red";
        updateWifiBars(false);

        elSystemStatusBadge.textContent = "System Offline";
        elSystemStatusBadge.className = "status-text text-red";
        document.querySelector('.status-indicator').className = "status-indicator offline";

        if (isLastConnectionOk) {
            logEvent("ESP32 network connection lost! Checking link...", "danger");
            isLastConnectionOk = false;
        }
    }
}

// WIFI SIGNAL GRAPHIC
function updateWifiBars(isConnected) {
    const bars = elWifiBars.querySelectorAll('.bar');
    bars.forEach(bar => {
        if (isConnected) {
            bar.classList.add('active');
        } else {
            bar.classList.remove('active');
        }
    });
}

// SENSOR UPDATERS
function updateGasSensor(ppm) {
    const prevVal = state.sensors.gas;
    state.sensors.gas = ppm;
    elMq2Value.textContent = Math.round(ppm);

    // Rotate Gauge Hand (representing stroke-dashoffset)
    // Full arc is 125.6 stroke-dasharray. Empty is 125.6, Full is 0. Max PPM is 900
    const maxPPM = 900;
    const minPPM = 50;
    const percentage = Math.min(Math.max((ppm - minPPM) / (maxPPM - minPPM), 0), 1);
    const offset = 125.6 - (percentage * 125.6);
    elMq2GaugeFill.style.strokeDashoffset = offset;

    // Status Logic
    if (ppm < 250) {
        elMq2Badge.className = "badge badge-safe";
        elMq2Badge.textContent = "Safe";
        elMq2GaugeFill.style.stroke = "var(--color-safe)";
        elMq2StatusText.textContent = "Normal Air Quality";
        elMq2StatusText.className = "value font-semibold text-green";
        elCardMq2.style.borderColor = "var(--border-color)";
    } else if (ppm >= 250 && ppm < 450) {
        elMq2Badge.className = "badge badge-warning";
        elMq2Badge.textContent = "Warning";
        elMq2GaugeFill.style.stroke = "var(--color-warning)";
        elMq2StatusText.textContent = "Elevated Gas Detected";
        elMq2StatusText.className = "value font-semibold text-yellow";
        elCardMq2.style.borderColor = "var(--color-warning)";

        if (prevVal < 250) {
            logEvent(`MQ2 Gas Leak Warning: ${Math.round(ppm)} PPM.`, "warning");
            incrementStat('gas');
            playSound('chime');
        }
    } else {
        elMq2Badge.className = "badge badge-danger";
        elMq2Badge.textContent = "Danger";
        elMq2GaugeFill.style.stroke = "var(--color-danger)";
        elMq2StatusText.textContent = "GAS LEAKAGE DETECTED!";
        elMq2StatusText.className = "value font-semibold text-red";
        elCardMq2.style.borderColor = "var(--color-danger)";

        if (prevVal < 450) {
            logEvent(`MQ2 CRITICAL GAS LEAKAGE: ${Math.round(ppm)} PPM!`, "danger");
            incrementStat('gas');
            playSound('siren');
        }
    }

    // Push data to Chart
    pushGasChartData(ppm);
}

function updateFlameSensor(flameState) {
    const prevFlame = state.sensors.flame;
    state.sensors.flame = flameState;

    if (flameState === 0) {
        elFlameBadge.className = "badge badge-safe";
        elFlameBadge.textContent = "Safe";
        elFlameStatusText.textContent = "Environment Clear";
        elFlameStatusText.className = "value font-semibold text-green";
        elCardFlame.classList.remove('flame-detected');
        elCardFlame.style.borderColor = "var(--border-color)";

        if (prevFlame === 1) {
            logEvent("Fire threat cleared.", "safe");
            if (state.sensors.gas < 450) {
                playSound('stop-siren');
            }
        }
    } else {
        elFlameBadge.className = "badge badge-danger";
        elFlameBadge.textContent = "Detected";
        elFlameStatusText.textContent = "FIRE DETECTED!";
        elFlameStatusText.className = "value font-semibold text-red";
        elCardFlame.classList.add('flame-detected');
        elCardFlame.style.borderColor = "var(--color-danger)";

        if (prevFlame === 0) {
            logEvent("CRITICAL FIRE DETECTED! Evacuate immediately!", "danger");
            incrementStat('fire');
            playSound('siren');
        }
    }
}

function updateVibrationSensor(vibeState) {
    const prevVibe = state.sensors.vibration;
    state.sensors.vibration = vibeState;

    const vibeIcon = elVibrationWrapper.querySelector('i') || elVibrationWrapper.querySelector('svg');

    if (vibeState === 0) {
        elVibrationBadge.className = "badge badge-safe";
        elVibrationBadge.textContent = "Safe";
        elVibrationStatusText.textContent = "No Intrusion Detected";
        elVibrationStatusText.className = "value font-semibold text-green";
        elCardVibration.classList.remove('vibration-active');
        if (vibeIcon) vibeIcon.setAttribute('data-lucide', 'shield');
        elCardVibration.style.borderColor = "var(--border-color)";

        if (prevVibe === 1) {
            logEvent("Security perimeter secure.", "safe");
        }
    } else {
        elVibrationBadge.className = "badge badge-warning";
        elVibrationBadge.textContent = "Detected";
        elVibrationStatusText.textContent = "INTRUDER DETECTED!";
        elVibrationStatusText.className = "value font-semibold text-yellow";
        elCardVibration.classList.add('vibration-active');
        if (vibeIcon) vibeIcon.setAttribute('data-lucide', 'shield-alert');
        elCardVibration.style.borderColor = "var(--color-warning)";

        if (prevVibe === 0) {
            logEvent("Intruder vibration detected on main perimeter entrance!", "warning");
            incrementStat('vibration');
            playSound('chime');
        }
    }
    lucide.createIcons();
}

// DOOR LOCK LOGIC
function handleKeypadInput(value) {
    if (value === 'clear') {
        state.door.passcodeBuffer = '';
        updateKeypadDisplay();
        playSound('chime');
    } else if (value === 'enter') {
        if (state.door.passcodeBuffer === state.door.correctPasscode) {
            toggleDoorLockState(true);
        } else {
            triggerKeypadError();
        }
    } else {
        if (state.door.passcodeBuffer.length < 4) {
            state.door.passcodeBuffer += value;
            updateKeypadDisplay();
            playSound('chime');
        }
    }
}

function updateKeypadDisplay() {
    const len = state.door.passcodeBuffer.length;
    if (len === 0) {
        elKeypadDisplay.textContent = '••••';
        elKeypadDisplay.className = 'keypad-display';
    } else {
        elKeypadDisplay.textContent = '*'.repeat(len);
        elKeypadDisplay.className = 'keypad-display';
    }
}

function triggerKeypadError() {
    elKeypadDisplay.textContent = 'FAIL';
    elKeypadDisplay.className = 'keypad-display error';
    playSound('chime');
    logEvent("Unauthorized entry attempt! Incorrect keypad PIN entered.", "danger");
    incrementStat('vibration');

    setTimeout(() => {
        state.door.passcodeBuffer = '';
        updateKeypadDisplay();
    }, 1000);
}

function toggleDoorLockState(userAction = false) {
    const willLock = !state.door.locked;

    state.door.locked = willLock;
    state.door.servoAngle = willLock ? 0 : 90;

    updateDoorLockUI(willLock, state.door.servoAngle);

    const now = new Date();
    elDoorLastAuth.textContent = userAction ? now.toLocaleTimeString() : "System Node";

    if (userAction) {
        writeDoorLockToESP32(willLock);
    }

    if (willLock) {
        logEvent("Secure door locked. Servo returned to 0°.", "safe");
        elKeypadDisplay.textContent = 'LOCK';
        elKeypadDisplay.className = 'keypad-display error';
    } else {
        logEvent("Access granted. Door unlocked. Servo swept to 90°.", "safe");
        elKeypadDisplay.textContent = 'OPEN';
        elKeypadDisplay.className = 'keypad-display success';
    }
    playSound('chime');

    setTimeout(() => {
        state.door.passcodeBuffer = '';
        updateKeypadDisplay();
    }, 1200);
}

function updateDoorLockUI(isLocked, angle) {
    const mainLockIcon = document.getElementById('main-lock-icon');
    if (isLocked) {
        elDoorLockContainer.classList.remove('unlocked');
        elDoorBadge.className = 'badge badge-locked';
        elDoorBadge.innerHTML = '<i data-lucide="lock-keyhole"></i> Locked';
        elDoorLockStatus.textContent = "Locked";
        elDoorLockStatus.className = "value text-red font-semibold";
        elDoorServoStatus.textContent = `${angle}° (Lock Mode)`;
        elServoHand.style.transform = `translate(0, -50%) rotate(180deg)`;
        elServoAngle.textContent = `${angle}°`;
        if (mainLockIcon) mainLockIcon.setAttribute('data-lucide', 'lock');
    } else {
        elDoorLockContainer.classList.add('unlocked');
        elDoorBadge.className = 'badge badge-unlocked';
        elDoorBadge.innerHTML = '<i data-lucide="lock-keyhole-open"></i> Unlocked';
        elDoorLockStatus.textContent = "Unlocked";
        elDoorLockStatus.className = "value text-green font-semibold";
        elDoorServoStatus.textContent = `${angle}° (Access Mode)`;
        elServoHand.style.transform = `translate(0, -50%) rotate(90deg)`;
        elServoAngle.textContent = `${angle}°`;
        if (mainLockIcon) mainLockIcon.setAttribute('data-lucide', 'unlock');
    }
    lucide.createIcons();
}

async function writeDoorLockToESP32(locked) {
    const ip = state.esp32Ip;
    if (!ip) return;

    const stateStr = locked ? "Locked" : "Unlocked";
    const url = `http://${ip}/door?state=${stateStr}`;

    logEvent(`Sending ${stateStr} command to ESP32...`, "info");

    try {
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors'
        });
        if (response.ok) {
            logEvent(`Lock command [${stateStr}] accepted by ESP32`, "safe");
        } else {
            throw new Error(`HTTP status: ${response.status}`);
        }
    } catch (error) {
        console.error("ESP32 Lock Command Error: ", error);
        logEvent(`Failed sending Lock command to ESP32: ${error.message}`, "danger");
    }
}

function updateDoorLockFromESP32(doorStatus) {
    const expectedLocked = (doorStatus === "Locked");
    if (expectedLocked !== state.door.locked) {
        state.door.locked = expectedLocked;
        state.door.servoAngle = expectedLocked ? 0 : 90;
        updateDoorLockUI(expectedLocked, state.door.servoAngle);

        if (expectedLocked) {
            logEvent("Lock status synchronized: Locked (0°)", "safe");
        } else {
            logEvent("Lock status synchronized: Unlocked (90°)", "safe");
        }
    }
}

// LOG SYSTEM INCIDENTS
function logEvent(msg, type = "safe") {
    elLogEmptyMsg.style.display = 'none';

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour12: false });

    const logItem = document.createElement('div');
    logItem.className = `log-item log-${type}`;

    let iconName = 'info';
    if (type === 'danger') iconName = 'alert-octagon';
    if (type === 'warning') iconName = 'alert-triangle';
    if (type === 'safe') iconName = 'check-circle';

    logItem.innerHTML = `
        <div class="log-icon-box">
            <i data-lucide="${iconName}"></i>
        </div>
        <div class="log-content">
            <p class="log-msg">${msg}</p>
            <div class="log-meta">
                <span class="log-time">${timeStr}</span>
                <span class="log-badge">${type}</span>
            </div>
        </div>
    `;

    elLogsContainer.insertBefore(logItem, elLogsContainer.firstChild);
    lucide.createIcons();

    while (elLogsContainer.children.length > 30) {
        elLogsContainer.removeChild(elLogsContainer.lastChild);
    }
}

function clearLogs() {
    elLogsContainer.innerHTML = '';
    elLogsContainer.appendChild(elLogEmptyMsg);
    elLogEmptyMsg.style.display = 'flex';
    logEvent("Event log history cleared.", "safe");
    playSound('chime');
}

// STATS SYSTEM
function incrementStat(type) {
    state.stats.totalAlerts++;

    if (type === 'gas') state.stats.gasEvents++;
    if (type === 'fire') state.stats.fireEvents++;
    if (type === 'vibration') state.stats.intrusionEvents++;

    updateStatsUI();
    updateActivityChart();
}

function updateStatsUI() {
    elStatTotal.textContent = state.stats.totalAlerts;
    elStatGas.textContent = state.stats.gasEvents;
    elStatFire.textContent = state.stats.fireEvents;
    elStatVibe.textContent = state.stats.intrusionEvents;
}

// CHART INTEGRATIONS (CHART.JS)
function initCharts() {
    const initialTime = new Date();
    for (let i = MAX_CHART_POINTS; i > 0; i--) {
        const pastTime = new Date(initialTime.getTime() - i * 3000);
        gasChartLabels.push(pastTime.toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }));
        gasChartData.push(110 + Math.floor(Math.random() * 20));
    }

    const ctxGas = document.getElementById('gasChart').getContext('2d');
    const gradGas = ctxGas.createLinearGradient(0, 0, 0, 160);
    gradGas.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
    gradGas.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    gasChart = new Chart(ctxGas, {
        type: 'line',
        data: {
            labels: gasChartLabels,
            datasets: [{
                label: 'Gas Level (PPM)',
                data: gasChartData,
                borderColor: '#3b82f6',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: true,
                backgroundColor: gradGas,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { display: false }
                },
                y: {
                    min: 0,
                    max: 1000,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#64748b', font: { size: 9 } }
                }
            }
        }
    });

    const ctxAct = document.getElementById('activityChart').getContext('2d');
    activityChart = new Chart(ctxAct, {
        type: 'bar',
        data: {
            labels: ['Gas Alerts', 'Fire Alerts', 'Intrusions'],
            datasets: [{
                data: [state.stats.gasEvents, state.stats.fireEvents, state.stats.intrusionEvents],
                backgroundColor: ['#06b6d4', '#ef4444', '#f59e0b'],
                borderRadius: 6,
                borderWidth: 0,
                barThickness: 32
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#e2e8f0', font: { size: 10, weight: 'bold' } }
                },
                y: {
                    beginAtZero: true,
                    min: 0,
                    max: 5,
                    stepSize: 1,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#64748b', font: { size: 9 } }
                }
            }
        }
    });
}

function pushGasChartData(val) {
    if (!gasChart) return;

    const timeStr = new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });

    gasChart.data.labels.push(timeStr);
    gasChart.data.datasets[0].data.push(val);

    if (gasChart.data.labels.length > MAX_CHART_POINTS) {
        gasChart.data.labels.shift();
        gasChart.data.datasets[0].data.shift();
    }

    gasChart.update('none');
}

function updateActivityChart() {
    if (!activityChart) return;

    const maxVal = Math.max(state.stats.gasEvents, state.stats.fireEvents, state.stats.intrusionEvents, 5);

    activityChart.data.datasets[0].data = [state.stats.gasEvents, state.stats.fireEvents, state.stats.intrusionEvents];
    activityChart.options.scales.y.max = maxVal + 1;
    activityChart.update();
}
