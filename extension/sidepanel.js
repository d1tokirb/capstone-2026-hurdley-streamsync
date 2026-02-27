// Connect to the local server
const socket = io('http://localhost:3000');

// DOM Elements
const statusDiv = document.getElementById('connection-status');
const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');
const leaveBtn = document.getElementById('leave-btn');
const roomInfo = document.getElementById('room-info');
const currentRoomIdSpan = document.getElementById('current-room-id');
const chatContainer = document.getElementById('chat-container');

// New DOM Elements
const currentVideoLink = document.getElementById('current-video-link');
const hostControls = document.getElementById('host-controls');
const newVideoUrlInput = document.getElementById('new-video-url');
const changeUrlBtn = document.getElementById('change-url-btn');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

// UI Elements (Settings)
const themeSelect = document.getElementById('theme-select');
const accentSelect = document.getElementById('accent-select');
const textSizeSelect = document.getElementById('text-size-select');
const muteSystemToggle = document.getElementById('mute-system-toggle');
const audioAlertsToggle = document.getElementById('audio-alerts-toggle');
const dndToggle = document.getElementById('dnd-toggle');

// UI Elements (Room Settings)
const openRoomSettingsBtn = document.getElementById('open-room-settings-btn');
const closeRoomSettingsBtn = document.getElementById('close-room-settings-btn');
const roomSettingsView = document.getElementById('room-settings-view');
const syncSensitivitySlider = document.getElementById('sync-sensitivity-slider');
const syncSensitivityValue = document.getElementById('sync-sensitivity-value');
const strictModeToggle = document.getElementById('strict-mode-toggle');
const autoPauseToggle = document.getElementById('auto-pause-toggle');

let currentRoom = null;
let isHost = false;

// Room settings (synced from server)
let roomSettings = {
    syncSensitivity: 0.5,
    strictMode: false,
    autoPause: false
};

// Helper to update status UI
function updateStatus(connected) {
    if (connected) {
        statusDiv.textContent = 'Connected';
        statusDiv.classList.add('connected');
        statusDiv.classList.remove('disconnected');
    } else {
        statusDiv.textContent = 'Disconnected';
        statusDiv.classList.add('disconnected');
        statusDiv.classList.remove('connected');
    }
}

socket.on('connect', () => {
    console.log('Connected to server');
    updateStatus(true);
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    updateStatus(false);
});

socket.on('error', (msg) => {
    showToast('Error: ' + msg, 'error');
});

// --- Settings Initialization & Persistence ---

let appSettings = {
    theme: 'light',
    accent: 'rose',
    textSize: 'medium',
    muteSystem: false,
    audioAlerts: true,
    dnd: false
};

function applySettingsToDOM() {
    // Visuals
    document.documentElement.setAttribute('data-theme', appSettings.theme);
    document.documentElement.setAttribute('data-accent', appSettings.accent);

    // Text Size
    let fontSize = '0.9rem';
    if (appSettings.textSize === 'small') fontSize = '0.8rem';
    if (appSettings.textSize === 'large') fontSize = '1rem';
    document.documentElement.style.setProperty('--chat-font-size', fontSize);

    // Update inputs
    if (themeSelect) themeSelect.value = appSettings.theme;
    if (accentSelect) accentSelect.value = appSettings.accent;
    if (textSizeSelect) textSizeSelect.value = appSettings.textSize;
    if (muteSystemToggle) muteSystemToggle.checked = appSettings.muteSystem;
    if (audioAlertsToggle) audioAlertsToggle.checked = appSettings.audioAlerts;
    if (dndToggle) dndToggle.checked = appSettings.dnd;
}

function saveSettings() {
    // Read from inputs
    appSettings.theme = themeSelect ? themeSelect.value : 'light';
    appSettings.accent = accentSelect ? accentSelect.value : 'rose';
    appSettings.textSize = textSizeSelect ? textSizeSelect.value : 'medium';
    appSettings.muteSystem = muteSystemToggle ? muteSystemToggle.checked : false;
    appSettings.audioAlerts = audioAlertsToggle ? audioAlertsToggle.checked : true;
    appSettings.dnd = dndToggle ? dndToggle.checked : false;

    // Apply & Save
    applySettingsToDOM();
    chrome.storage.local.set({ streamSyncSettings: appSettings });
}

// Add event listeners to all settings inputs
[themeSelect, accentSelect, textSizeSelect, muteSystemToggle, audioAlertsToggle, dndToggle].forEach(el => {
    if (el) {
        el.addEventListener('change', saveSettings);
    }
});

let authenticatedUsername = null;

// Check for saved room and load settings on init
chrome.storage.local.get(['savedRoomId', 'streamSyncSettings'], (result) => {
    if (result.streamSyncSettings) {
        appSettings = { ...appSettings, ...result.streamSyncSettings };
    }
    applySettingsToDOM();

    if (result.savedRoomId) {
        console.log('Found saved room:', result.savedRoomId);
        roomInput.value = result.savedRoomId;
        // Joining will be handled in onUserAuthenticated if they are logged in
    }
});

// Firebase Auth Hooks
window.onUserAuthenticated = function (name, uid) {
    authenticatedUsername = name;
    document.getElementById('display-username').textContent = name;

    // If they have a saved room, auto join now that they are authenticated
    chrome.storage.local.get(['savedRoomId'], (result) => {
        if (result.savedRoomId) {
            joinRoom(result.savedRoomId, authenticatedUsername);
        }
    });
};

window.onUserLoggedOut = function () {
    authenticatedUsername = null;
    if (currentRoom) {
        chrome.storage.local.remove(['savedRoomId']);
        location.reload(); // Reload to reset state fully
    }
};

// Join Room Logic
function joinRoom(id, username) {
    if (id && username) {
        socket.emit('join-room', { roomId: id, username: username });
        currentRoom = id;
        showRoomUI(id);

        // Save to storage
        chrome.storage.local.set({ savedRoomId: id });
    } else {
        showToast("Please enter a Room ID.", "error");
    }
}

// Join Room Listener
joinBtn.addEventListener('click', () => {
    const roomId = roomInput.value.trim();
    if (!authenticatedUsername) {
        showToast("Please log in first.", "error");
        return;
    }
    joinRoom(roomId, authenticatedUsername);
});

// Leave Room
leaveBtn.addEventListener('click', () => {
    // Clear storage
    chrome.storage.local.remove(['savedRoomId']);
    location.reload();
});

function showRoomUI(roomId) {
    document.getElementById('room-controls').classList.add('hidden');
    roomInfo.classList.remove('hidden');
    currentRoomIdSpan.textContent = roomId;
    chatContainer.classList.remove('hidden');
}

// Room State (Initial)
socket.on('room-state', (state) => {
    isHost = state.isHost;
    updateHostUI();
    if (state.currentUrl) {
        updateVideoInfo(state.currentUrl);
    }
    if (state.settings) {
        roomSettings = { ...roomSettings, ...state.settings };
        applyRoomSettingsToUI();
    }
});

// Host Updates
socket.on('you-are-host', () => {
    isHost = true;
    updateHostUI();
    showToast("👑 You are now the host!", "success");
});

function updateHostUI() {
    if (isHost) {
        hostControls.classList.remove('hidden');
        openRoomSettingsBtn.classList.remove('hidden');
    } else {
        hostControls.classList.add('hidden');
        openRoomSettingsBtn.classList.add('hidden');
        roomSettingsView.classList.add('hidden');
    }
}

// --- Room Settings Logic ---
function applyRoomSettingsToUI() {
    if (syncSensitivitySlider) syncSensitivitySlider.value = roomSettings.syncSensitivity;
    if (syncSensitivityValue) syncSensitivityValue.textContent = roomSettings.syncSensitivity + 's';
    if (strictModeToggle) strictModeToggle.checked = roomSettings.strictMode;
    if (autoPauseToggle) autoPauseToggle.checked = roomSettings.autoPause;
}

// Open / Close Room Settings
if (openRoomSettingsBtn) {
    openRoomSettingsBtn.addEventListener('click', () => {
        roomSettingsView.classList.toggle('hidden');
    });
}
if (closeRoomSettingsBtn) {
    closeRoomSettingsBtn.addEventListener('click', () => {
        roomSettingsView.classList.add('hidden');
    });
}

// Slider live update
if (syncSensitivitySlider) {
    syncSensitivitySlider.addEventListener('input', () => {
        syncSensitivityValue.textContent = syncSensitivitySlider.value + 's';
    });
    syncSensitivitySlider.addEventListener('change', () => {
        roomSettings.syncSensitivity = parseFloat(syncSensitivitySlider.value);
        socket.emit('update-room-settings', roomSettings);
    });
}

// Toggle listeners
if (strictModeToggle) {
    strictModeToggle.addEventListener('change', () => {
        roomSettings.strictMode = strictModeToggle.checked;
        socket.emit('update-room-settings', roomSettings);
    });
}
if (autoPauseToggle) {
    autoPauseToggle.addEventListener('change', () => {
        roomSettings.autoPause = autoPauseToggle.checked;
        socket.emit('update-room-settings', roomSettings);
    });
}

// Receive settings updates from server
socket.on('room-settings-updated', (settings) => {
    roomSettings = { ...roomSettings, ...settings };
    applyRoomSettingsToUI();
    if (!isHost) {
        showToast('Room settings updated by host.', 'info');
    }
});

// Update Video Info UI
function updateVideoInfo(url) {
    currentVideoLink.href = url;
    currentVideoLink.textContent = url;
}

// Change URL (Host)
changeUrlBtn.addEventListener('click', () => {
    const url = newVideoUrlInput.value.trim();
    if (url) {
        socket.emit('change-url', url);
        // Optimistic update for host
        updateVideoInfo(url);
        newVideoUrlInput.value = '';
    }
});

// Incoming URL Change
socket.on('url-change', (newUrl) => {
    console.log('Host changed URL to:', newUrl);
    updateVideoInfo(newUrl);

    // Attempt to update current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.update(tabs[0].id, { url: newUrl });
        }
    });
});

// Audio Context for the "Ding" alert
let audioCtx = null;
function playAudioAlert() {
    if (!appSettings.audioAlerts || appSettings.dnd) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.05); // A6

        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
        console.error("Audio block:", e);
    }
}

// Chat Logic
function appendMessage(senderName, text, isMine, isSystem = false) {
    if (isSystem && appSettings.muteSystem) return; // Respect Mute System Messages

    const div = document.createElement('div');
    div.classList.add('chat-msg');

    // Apply dynamic font size
    div.style.fontSize = 'var(--chat-font-size, 0.9rem)';

    if (isSystem) {
        div.classList.add('system-msg');
        div.textContent = text;
    } else {
        if (isMine) {
            div.classList.add('mine');
        } else {
            // Play sound for incoming user messages
            playAudioAlert();
        }

        const b = document.createElement('b');
        b.textContent = `${isMine ? "You" : senderName}: `;
        b.style.color = isMine ? 'white' : 'var(--primary)'; // Accent color for names

        div.appendChild(b);
        div.appendChild(document.createTextNode(text));
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendChatBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

function sendChatMessage() {
    const text = chatInput.value.trim();
    if (text) {
        socket.emit('chat-message', text);
        chatInput.value = '';
    }
}

socket.on('chat-message', (data) => {
    appendMessage(data.username, data.text, data.senderId === socket.id, data.isSystem);
});


// Core Video Sync Logic
// Check if we are connected to a tab with a video
async function sendMessageToContentScript(message) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
        try {
            await chrome.tabs.sendMessage(tab.id, message);
        } catch (error) {
            console.log('Content script not ready or no video on page:', error);
        }
    }
}

// Listen for sync events from server --> Send to Content Script
socket.on('sync-event', (data) => {
    console.log('Received sync event from server:', data);
    sendMessageToContentScript({
        action: 'sync-video',
        data: data,
        syncSensitivity: roomSettings.syncSensitivity
    });
});

// Listen for messages from Content Script --> Send to Server
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'video-event') {
        if (currentRoom) {
            // Strict Mode: Block non-host video events
            if (roomSettings.strictMode && !isHost) {
                console.log('Strict Mode: Blocking non-host video event.');
                return;
            }
            console.log('Broadcasting video event:', message.data);
            socket.emit('sync-event', message.data);
        }
    } else if (message.action === 'ad-start') {
        if (currentRoom) {
            socket.emit('ad-event', { type: 'start' });
            socket.emit('sync-event', { type: 'pause', time: null }); // Pause without rewinding to 0
        }
    } else if (message.action === 'ad-end') {
        if (currentRoom) {
            socket.emit('chat-message', '✅ Ad finished. Resuming...');
        }
    }
});

// --- Toast Notification System ---
function showToast(message, type = 'info') {
    if (typeof appSettings !== 'undefined' && appSettings.dnd) return;

    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3000);
}
