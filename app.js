// ============================================
// DIFFIE-HELLMAN MITM SIMULATION
// ============================================

// State Management
const state = {
    p: 23,
    g: 5,
    mitmEnabled: false,

    alice: {
        secret: null,
        publicValue: null,
        sharedKey: null
    },

    bob: {
        secret: null,
        publicValue: null,
        sharedKey: null
    },

    mallory: {
        secret: null,
        publicValue: null,
        aliceKey: null,
        bobKey: null
    },

    protocolStarted: false,
    chatEnabled: false,
    pendingIntercept: null
};

// DOM Elements
const elements = {
    // Controls
    pValue: document.getElementById('p-value'),
    gValue: document.getElementById('g-value'),
    mitmToggle: document.getElementById('mitm-enabled'),
    startButton: document.getElementById('start-protocol'),

    // Participants
    aliceSecret: document.getElementById('alice-secret'),
    alicePublic: document.getElementById('alice-public'),
    aliceShared: document.getElementById('alice-shared'),
    aliceStatus: document.getElementById('alice-status'),

    bobSecret: document.getElementById('bob-secret'),
    bobPublic: document.getElementById('bob-public'),
    bobShared: document.getElementById('bob-shared'),
    bobStatus: document.getElementById('bob-status'),

    mallorySecret: document.getElementById('mallory-secret'),
    malloryPublic: document.getElementById('mallory-public'),
    malloryAliceKey: document.getElementById('mallory-alice-key'),
    malloryBobKey: document.getElementById('mallory-bob-key'),
    malloryStatus: document.getElementById('mallory-status'),
    mallorySection: document.getElementById('mallory-section'),

    // Exchange
    exchangeFlow: document.getElementById('exchange-flow'),

    // Chat
    aliceMessages: document.getElementById('alice-messages'),
    aliceInput: document.getElementById('alice-input'),
    aliceSend: document.getElementById('alice-send'),

    bobMessages: document.getElementById('bob-messages'),
    bobInput: document.getElementById('bob-input'),
    bobSend: document.getElementById('bob-send'),

    interceptMessages: document.getElementById('intercept-messages'),
    malloryIntercept: document.getElementById('mallory-intercept'),

    // Log
    logContent: document.getElementById('log-content'),
    clearLog: document.getElementById('clear-log')
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Modular exponentiation: (base^exp) mod mod
function modPow(base, exp, mod) {
    if (mod === 1) return 0;
    let result = 1;
    base = base % mod;
    while (exp > 0) {
        if (exp % 2 === 1) {
            result = (result * base) % mod;
        }
        exp = Math.floor(exp / 2);
        base = (base * base) % mod;
    }
    return result;
}

// XOR encryption/decryption
function xorCipher(text, key) {
    return text.split('').map(char =>
        String.fromCharCode(char.charCodeAt(0) ^ key)
    ).join('');
}

// Get current timestamp
function getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('es-ES', { hour12: false });
}

// Add log entry
function addLog(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
        <span class="log-timestamp">[${getTimestamp()}]</span>
        <span class="log-message">${message}</span>
    `;
    elements.logContent.appendChild(entry);
    elements.logContent.scrollTop = elements.logContent.scrollHeight;
}

// Update status indicator
function updateStatus(participant, text, active = false) {
    const statusElement = elements[`${participant}Status`];
    const statusText = statusElement.querySelector('.status-text');
    statusText.textContent = text;

    statusElement.classList.remove('active', 'warning');
    if (active) {
        statusElement.classList.add(participant === 'mallory' ? 'warning' : 'active');
    }
}

// ============================================
// DIFFIE-HELLMAN PROTOCOL
// ============================================

function startProtocol() {
    // Validate inputs
    state.p = parseInt(elements.pValue.value);
    state.g = parseInt(elements.gValue.value);

    const aliceSecret = parseInt(elements.aliceSecret.value);
    const bobSecret = parseInt(elements.bobSecret.value);

    if (!aliceSecret || aliceSecret < 3 || aliceSecret > 10) {
        alert('Alice debe ingresar un secreto entre 3 y 10');
        return;
    }

    if (!bobSecret || bobSecret < 3 || bobSecret > 10) {
        alert('Bob debe ingresar un secreto entre 3 y 10');
        return;
    }

    if (state.mitmEnabled) {
        const mallorySecret = parseInt(elements.mallorySecret.value);
        if (!mallorySecret || mallorySecret < 3 || mallorySecret > 10) {
            alert('Mallory debe ingresar un secreto entre 3 y 10');
            return;
        }
        state.mallory.secret = mallorySecret;
    }

    state.alice.secret = aliceSecret;
    state.bob.secret = bobSecret;
    state.protocolStarted = true;

    // Clear previous exchange
    elements.exchangeFlow.innerHTML = '';

    addLog('='.repeat(60), 'info');
    addLog('INICIANDO PROTOCOLO DIFFIE-HELLMAN', 'info');
    addLog(`Parámetros públicos: p = ${state.p}, g = ${state.g}`, 'info');
    addLog('='.repeat(60), 'info');

    // Disable inputs
    elements.aliceSecret.disabled = true;
    elements.bobSecret.disabled = true;
    elements.mallorySecret.disabled = true;
    elements.pValue.disabled = true;
    elements.gValue.disabled = true;
    elements.mitmToggle.disabled = true;
    elements.startButton.disabled = true;

    if (state.mitmEnabled) {
        executeMITMProtocol();
    } else {
        executeNormalProtocol();
    }
}

function executeNormalProtocol() {
    addLog('Modo: COMUNICACIÓN DIRECTA (sin MITM)', 'info');

    // Alice generates A
    state.alice.publicValue = modPow(state.g, state.alice.secret, state.p);
    elements.alicePublic.textContent = state.alice.publicValue;
    updateStatus('alice', 'Generando valor público...', true);
    addLog(`Alice genera A = g^a mod p = ${state.g}^${state.alice.secret} mod ${state.p} = ${state.alice.publicValue}`, 'alice');

    addExchangeStep('Alice -> Bob', `Envía A = ${state.alice.publicValue}`, 'alice', '>');

    setTimeout(() => {
        // Bob generates B
        state.bob.publicValue = modPow(state.g, state.bob.secret, state.p);
        elements.bobPublic.textContent = state.bob.publicValue;
        updateStatus('bob', 'Generando valor público...', true);
        addLog(`Bob genera B = g^b mod p = ${state.g}^${state.bob.secret} mod ${state.p} = ${state.bob.publicValue}`, 'bob');

        addExchangeStep('Bob -> Alice', `Envía B = ${state.bob.publicValue}`, 'bob', '<');

        setTimeout(() => {
            // Calculate shared keys
            state.alice.sharedKey = modPow(state.bob.publicValue, state.alice.secret, state.p);
            state.bob.sharedKey = modPow(state.alice.publicValue, state.bob.secret, state.p);

            elements.aliceShared.textContent = state.alice.sharedKey;
            elements.bobShared.textContent = state.bob.sharedKey;

            addLog(`Alice calcula clave: K = B^a mod p = ${state.bob.publicValue}^${state.alice.secret} mod ${state.p} = ${state.alice.sharedKey}`, 'alice');
            addLog(`Bob calcula clave: K = A^b mod p = ${state.alice.publicValue}^${state.bob.secret} mod ${state.p} = ${state.bob.sharedKey}`, 'bob');

            if (state.alice.sharedKey === state.bob.sharedKey) {
                addLog('[OK] CLAVES COINCIDEN - Comunicación segura establecida', 'info');
                updateStatus('alice', 'Clave establecida', true);
                updateStatus('bob', 'Clave establecida', true);

                enableChat();
            } else {
                addLog('[ERROR] Las claves no coinciden', 'mallory');
            }
        }, 1000);
    }, 1000);
}

function executeMITMProtocol() {
    addLog('[MITM] Modo: ATAQUE MAN-IN-THE-MIDDLE ACTIVO', 'mallory');

    // Mallory generates M
    state.mallory.publicValue = modPow(state.g, state.mallory.secret, state.p);
    elements.malloryPublic.textContent = state.mallory.publicValue;
    updateStatus('mallory', 'Interceptando...', true);
    addLog(`Mallory genera M = g^m mod p = ${state.g}^${state.mallory.secret} mod ${state.p} = ${state.mallory.publicValue}`, 'mallory');

    // Alice generates A
    state.alice.publicValue = modPow(state.g, state.alice.secret, state.p);
    elements.alicePublic.textContent = state.alice.publicValue;
    updateStatus('alice', 'Enviando a Bob...', true);
    addLog(`Alice genera A = g^a mod p = ${state.g}^${state.alice.secret} mod ${state.p} = ${state.alice.publicValue}`, 'alice');

    addExchangeStep('Alice -> Mallory', `Alice envía A = ${state.alice.publicValue} (interceptado)`, 'mallory', '!');

    setTimeout(() => {
        // Mallory sends M to Bob (pretending to be Alice)
        addExchangeStep('Mallory -> Bob', `Mallory envía M = ${state.mallory.publicValue} (haciéndose pasar por Alice)`, 'mallory', '!');
        addLog(`[MITM] Mallory intercepta y envía M = ${state.mallory.publicValue} a Bob`, 'mallory');

        setTimeout(() => {
            // Bob generates B
            state.bob.publicValue = modPow(state.g, state.bob.secret, state.p);
            elements.bobPublic.textContent = state.bob.publicValue;
            updateStatus('bob', 'Respondiendo...', true);
            addLog(`Bob genera B = g^b mod p = ${state.g}^${state.bob.secret} mod ${state.p} = ${state.bob.publicValue}`, 'bob');

            addExchangeStep('Bob -> Mallory', `Bob envía B = ${state.bob.publicValue} (interceptado)`, 'mallory', '!');

            setTimeout(() => {
                // Mallory sends M to Alice (pretending to be Bob)
                addExchangeStep('Mallory -> Alice', `Mallory envía M = ${state.mallory.publicValue} (haciéndose pasar por Bob)`, 'mallory', '!');
                addLog(`[MITM] Mallory intercepta y envía M = ${state.mallory.publicValue} a Alice`, 'mallory');

                setTimeout(() => {
                    // Calculate keys
                    state.alice.sharedKey = modPow(state.mallory.publicValue, state.alice.secret, state.p);
                    state.bob.sharedKey = modPow(state.mallory.publicValue, state.bob.secret, state.p);
                    state.mallory.aliceKey = modPow(state.alice.publicValue, state.mallory.secret, state.p);
                    state.mallory.bobKey = modPow(state.bob.publicValue, state.mallory.secret, state.p);

                    elements.aliceShared.textContent = state.alice.sharedKey;
                    elements.bobShared.textContent = state.bob.sharedKey;
                    elements.malloryAliceKey.textContent = state.mallory.aliceKey;
                    elements.malloryBobKey.textContent = state.mallory.bobKey;

                    addLog(`Alice calcula: K_A = M^a mod p = ${state.mallory.publicValue}^${state.alice.secret} mod ${state.p} = ${state.alice.sharedKey}`, 'alice');
                    addLog(`Bob calcula: K_B = M^b mod p = ${state.mallory.publicValue}^${state.bob.secret} mod ${state.p} = ${state.bob.sharedKey}`, 'bob');
                    addLog(`Mallory calcula K_A-M = A^m mod p = ${state.alice.publicValue}^${state.mallory.secret} mod ${state.p} = ${state.mallory.aliceKey}`, 'mallory');
                    addLog(`Mallory calcula K_M-B = B^m mod p = ${state.bob.publicValue}^${state.mallory.secret} mod ${state.p} = ${state.mallory.bobKey}`, 'mallory');

                    addLog('='.repeat(60), 'mallory');
                    addLog('[MITM] ATAQUE EXITOSO - Mallory tiene acceso a ambas claves', 'mallory');
                    addLog(`Clave Alice-Mallory: ${state.mallory.aliceKey}`, 'mallory');
                    addLog(`Clave Mallory-Bob: ${state.mallory.bobKey}`, 'mallory');
                    addLog('='.repeat(60), 'mallory');

                    // Verificar que las claves NO coinciden entre Alice y Bob
                    if (state.alice.sharedKey !== state.bob.sharedKey) {
                        addLog('[ADVERTENCIA] Alice y Bob tienen claves DIFERENTES', 'mallory');
                        addLog(`Clave de Alice: ${state.alice.sharedKey} | Clave de Bob: ${state.bob.sharedKey}`, 'mallory');
                        addLog('Alice y Bob NO pueden comunicarse directamente', 'mallory');
                        addLog('Mallory actúa como intermediario con claves separadas', 'mallory');
                    }
                    addLog('='.repeat(60), 'mallory');

                    updateStatus('alice', 'Clave establecida (comprometida)', true);
                    updateStatus('bob', 'Clave establecida (comprometida)', true);
                    updateStatus('mallory', 'Interceptando comunicaciones', true);

                    enableChat();
                }, 1000);
            }, 1000);
        }, 1000);
    }, 1000);
}

function addExchangeStep(title, detail, type, icon) {
    const step = document.createElement('div');
    step.className = `exchange-step ${type}-step`;
    step.innerHTML = `
        <div class="exchange-step-icon">${icon}</div>
        <div class="exchange-step-content">
            <div class="exchange-step-title">${title}</div>
            <div class="exchange-step-detail">${detail}</div>
        </div>
    `;
    elements.exchangeFlow.appendChild(step);
}

// ============================================
// CHAT FUNCTIONALITY
// ============================================

function enableChat() {
    state.chatEnabled = true;

    elements.aliceInput.disabled = false;
    elements.aliceSend.disabled = false;
    elements.bobInput.disabled = false;
    elements.bobSend.disabled = false;

    addLog('='.repeat(60), 'info');
    addLog('FASE DE MENSAJERÍA CIFRADA INICIADA', 'info');
    addLog('='.repeat(60), 'info');

    if (!state.mitmEnabled) {
        elements.malloryIntercept.style.display = 'none';
    }
}

// Alice sends message
elements.aliceSend.addEventListener('click', () => sendMessage('alice'));
elements.aliceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage('alice');
});

// Bob sends message
elements.bobSend.addEventListener('click', () => sendMessage('bob'));
elements.bobInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage('bob');
});

function sendMessage(sender) {
    const input = elements[`${sender}Input`];
    const message = input.value.trim();

    if (!message) return;

    input.value = '';

    if (sender === 'alice') {
        sendAliceMessage(message);
    } else {
        sendBobMessage(message);
    }
}

function sendAliceMessage(message) {
    // Display in Alice's chat
    addChatMessage('alice', message, true);

    if (state.mitmEnabled) {
        // Encrypt with Alice-Mallory key
        const encrypted = xorCipher(message, state.alice.sharedKey);
        addLog(`Alice envía (cifrado con K=${state.alice.sharedKey}): "${message}"`, 'alice');

        // Mallory intercepts
        setTimeout(() => {
            interceptMessage(message, encrypted, 'alice', state.mallory.aliceKey, state.mallory.bobKey);
        }, 300);
    } else {
        // Direct communication
        const encrypted = xorCipher(message, state.alice.sharedKey);
        addLog(`Alice -> Bob (cifrado): "${message}"`, 'alice');

        setTimeout(() => {
            const decrypted = xorCipher(encrypted, state.bob.sharedKey);
            addChatMessage('bob', decrypted, false);
            addLog(`Bob recibe (descifrado): "${decrypted}"`, 'bob');
        }, 300);
    }
}

function sendBobMessage(message) {
    // Display in Bob's chat
    addChatMessage('bob', message, true);

    if (state.mitmEnabled) {
        // Encrypt with Bob-Mallory key
        const encrypted = xorCipher(message, state.bob.sharedKey);
        addLog(`Bob envía (cifrado con K=${state.bob.sharedKey}): "${message}"`, 'bob');

        // Mallory intercepts
        setTimeout(() => {
            interceptMessage(message, encrypted, 'bob', state.mallory.bobKey, state.mallory.aliceKey);
        }, 300);
    } else {
        // Direct communication
        const encrypted = xorCipher(message, state.bob.sharedKey);
        addLog(`Bob -> Alice (cifrado): "${message}"`, 'bob');

        setTimeout(() => {
            const decrypted = xorCipher(encrypted, state.alice.sharedKey);
            addChatMessage('alice', decrypted, false);
            addLog(`Alice recibe (descifrado): "${decrypted}"`, 'alice');
        }, 300);
    }
}

function interceptMessage(original, encrypted, from, decryptKey, encryptKey) {
    const decrypted = xorCipher(encrypted, decryptKey);

    addLog(`[MITM] Mallory intercepta de ${from === 'alice' ? 'Alice' : 'Bob'}: "${decrypted}"`, 'mallory');

    // Create intercept UI
    const interceptItem = document.createElement('div');
    interceptItem.className = 'intercept-item';
    interceptItem.innerHTML = `
        <div class="intercept-header">
            <span class="intercept-direction">${from === 'alice' ? 'Alice -> Bob' : 'Bob -> Alice'}</span>
        </div>
        <div class="intercept-original">
            <div class="intercept-label">Mensaje interceptado:</div>
            <div class="intercept-text">${decrypted}</div>
        </div>
        <div class="intercept-modify">
            <input type="text" value="${decrypted}" placeholder="Modificar mensaje...">
            <button onclick="forwardMessage(this, '${from}', ${encryptKey})">Reenviar</button>
        </div>
    `;

    elements.interceptMessages.appendChild(interceptItem);
    elements.interceptMessages.scrollTop = elements.interceptMessages.scrollHeight;
}

function forwardMessage(button, from, encryptKey) {
    const input = button.previousElementSibling;
    const modifiedMessage = input.value;

    button.disabled = true;
    input.disabled = true;

    const target = from === 'alice' ? 'bob' : 'alice';

    if (modifiedMessage !== input.defaultValue) {
        addLog(`[MITM] Mallory MODIFICÓ el mensaje a: "${modifiedMessage}"`, 'mallory');
    } else {
        addLog(`Mallory reenvía sin cambios: "${modifiedMessage}"`, 'mallory');
    }

    // Re-encrypt and send to target
    setTimeout(() => {
        addChatMessage(target, modifiedMessage, false);
        addLog(`${target === 'alice' ? 'Alice' : 'Bob'} recibe: "${modifiedMessage}"`, target);
    }, 300);
}

function addChatMessage(participant, message, sent) {
    const messagesContainer = elements[`${participant}Messages`];
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sent ? 'message-sent' : 'message-received'}`;
    messageDiv.textContent = message;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ============================================
// EVENT LISTENERS
// ============================================

elements.mitmToggle.addEventListener('change', (e) => {
    state.mitmEnabled = e.target.checked;

    if (state.mitmEnabled) {
        elements.mallorySection.classList.remove('disabled');
        addLog('[MITM] Modo MITM activado - Mallory interceptará las comunicaciones', 'mallory');
    } else {
        elements.mallorySection.classList.add('disabled');
        addLog('Modo MITM desactivado - Comunicación directa', 'info');
    }
});

elements.startButton.addEventListener('click', startProtocol);

elements.clearLog.addEventListener('click', () => {
    elements.logContent.innerHTML = '';
    addLog('Registro limpiado', 'info');
});

// ============================================
// INITIALIZATION
// ============================================

function init() {
    addLog('Sistema de simulación Diffie-Hellman iniciado', 'info');
    addLog('Configure los parámetros y secretos para comenzar', 'info');

    // Initially disable Mallory section
    if (!state.mitmEnabled) {
        elements.mallorySection.classList.add('disabled');
    }
}

// Start the application
init();
