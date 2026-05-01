let chatHistory = [];
let geminiApiKey = sessionStorage.getItem('gemini_api_key') || '';
let chatWelcomeShown = false;
let typingIdCounter = 0;
let mindmapContextCache = null;
let chatFontPx = 14;
let chatIsFullscreen = false;
let lastFailedMessage = null;
let retryCountdownTimer = null;

const ICON_EXPAND =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>' +
    '<line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

const ICON_SHRINK =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>' +
    '<line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>';

// ── Context ────────────────────────────────────────────────────────────────

function buildMindmapContext() {
    if (mindmapContextCache) return mindmapContextCache;
    if (!allRows) return 'הנתונים עדיין לא נטענו.';
    let ctx = 'מבנה מפת המחשבה של SDLC (מחזור חיי תכנה) עם סוכני AI:\n\n';
    allRows.forEach(row => {
        const type = (row.TYPE || '').trim().toUpperCase();
        if (!type) return;
        const indent = type === 'STAGE' ? '' : type === 'SUBSTAGE' ? '  ' : '    ';
        const prefix = type === 'STAGE' ? '## שלב' : type === 'SUBSTAGE' ? '### תת-שלב' : '#### פעילות';
        ctx += `${indent}${prefix}: ${row.TITLE || ''}\n`;
        if (row.ACTORS)  ctx += `${indent}גורמים מעורבים: ${row.ACTORS}\n`;
        if (row.AGENT)   ctx += `${indent}סוכני AI: ${row.AGENT}\n`;
        if (row.CONTENT) ctx += `${indent}תיאור: ${row.CONTENT}\n`;
        ctx += '\n';
    });
    mindmapContextCache = ctx;
    return ctx;
}

// ── Open / close ───────────────────────────────────────────────────────────

function openChat() {
    document.getElementById('chat-overlay').style.display = 'flex';
    if (geminiApiKey) {
        document.getElementById('chat-api-section').style.display = 'none';
        if (!chatWelcomeShown) {
            chatWelcomeShown = true;
            appendChatMessage('assistant',
                'שלום! אני כאן לעזור לך לנווט במפת המחשבה של SDLC.\n' +
                'תוכל לשאול אותי מי אחראי על כל שלב, מה עושים בכל תהליך, אילו סוכני AI קיימים, ועוד.\n' +
                'במה אוכל לעזור?');
        }
        setTimeout(() => document.getElementById('chat-text-input').focus(), 50);
    } else {
        document.getElementById('chat-api-section').style.display = 'block';
        setTimeout(() => document.getElementById('api-key-input').focus(), 50);
    }
}

function closeChat() {
    document.getElementById('chat-overlay').style.display = 'none';
}

function handleOverlayClick(e) {
    if (!chatIsFullscreen && e.target === document.getElementById('chat-overlay')) closeChat();
}

// ── Fullscreen ─────────────────────────────────────────────────────────────

function toggleChatFullscreen() {
    chatIsFullscreen = !chatIsFullscreen;
    document.getElementById('chat-modal').classList.toggle('chat-fullscreen', chatIsFullscreen);
    document.getElementById('chat-overlay').classList.toggle('chat-fullscreen', chatIsFullscreen);
    const btn = document.getElementById('chat-fullscreen-btn');
    btn.innerHTML = chatIsFullscreen ? ICON_SHRINK : ICON_EXPAND;
    btn.title = chatIsFullscreen ? 'מסך רגיל' : 'מסך מלא';
}

// ── Chat font size ─────────────────────────────────────────────────────────

function changeChatFontSize(step) {
    chatFontPx = Math.max(10, Math.min(22, chatFontPx + step * 2));
    document.getElementById('chat-modal').style.setProperty('--chat-font-size', chatFontPx + 'px');
}

// ── API key ────────────────────────────────────────────────────────────────

function toggleApiKeySection() {
    const section = document.getElementById('chat-api-section');
    const isVisible = section.style.display === 'block';
    section.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        document.getElementById('api-key-input').value = '';
        setTimeout(() => document.getElementById('api-key-input').focus(), 50);
    }
}

function setApiKey() {
    const key = document.getElementById('api-key-input').value.trim();
    if (!key) return;
    geminiApiKey = key;
    sessionStorage.setItem('gemini_api_key', key);
    document.getElementById('chat-api-section').style.display = 'none';
    if (!chatWelcomeShown) {
        chatWelcomeShown = true;
        appendChatMessage('assistant',
            'שלום! אני כאן לעזור לך לנווט במפת המחשבה של SDLC.\n' +
            'תוכל לשאול אותי מי אחראי על כל שלב, מה עושים בכל תהליך, אילו סוכני AI קיימים, ועוד.\n' +
            'במה אוכל לעזור?');
    }
    setTimeout(() => document.getElementById('chat-text-input').focus(), 50);
}

// ── Send / receive ─────────────────────────────────────────────────────────

async function sendChatMessage() {
    const input = document.getElementById('chat-text-input');
    const text = input.value.trim();
    if (!text) return;
    if (!geminiApiKey) {
        document.getElementById('chat-api-section').style.display = 'block';
        document.getElementById('api-key-input').focus();
        return;
    }
    input.value = '';
    lastFailedMessage = text;
    const sendBtn = document.getElementById('chat-send-btn');
    sendBtn.disabled = true;
    input.disabled = true;

    appendChatMessage('user', text);
    const typingId = appendTypingIndicator();

    try {
        const reply = await callGeminiChat(text);
        removeTypingIndicator(typingId);
        appendChatMessage('assistant', reply);
        lastFailedMessage = null;
    } catch (err) {
        removeTypingIndicator(typingId);
        handleChatError(err);
    } finally {
        sendBtn.disabled = false;
        input.disabled = false;
        input.focus();
    }
}

function handleChatError(err) {
    if (/API_KEY|401|INVALID|API key/i.test(err.message)) {
        geminiApiKey = '';
        sessionStorage.removeItem('gemini_api_key');
        document.getElementById('chat-api-section').style.display = 'block';
        appendChatMessage('error', 'מפתח ה-API אינו תקף. אנא הזן מפתח חדש.');
    } else if (/high demand|overloaded|temporarily|503|429/i.test(err.message)) {
        startRetryCountdown();
    } else {
        appendChatMessage('error', 'שגיאה: ' + err.message);
    }
}

function startRetryCountdown() {
    if (retryCountdownTimer) { clearInterval(retryCountdownTimer); retryCountdownTimer = null; }

    const container = document.getElementById('chat-messages');
    container.querySelectorAll('.chat-message-error').forEach(el => el.remove());

    const wrapper = document.createElement('div');
    wrapper.id = 'chat-retry-bubble';
    wrapper.className = 'chat-message chat-message-error';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    wrapper.appendChild(bubble);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;

    let secs = 15;
    const render = () => {
        bubble.innerHTML =
            `⏳ המודל עמוס, מנסה שוב בעוד <strong>${secs}</strong> שניות...` +
            '<br><button class="chat-retry-btn" onclick="retryNow()">נסה עכשיו ↺</button>';
    };
    render();

    retryCountdownTimer = setInterval(() => {
        secs--;
        if (secs <= 0) {
            clearInterval(retryCountdownTimer);
            retryCountdownTimer = null;
            retryChatMessage();
        } else {
            render();
        }
    }, 1000);
}

function retryNow() {
    if (retryCountdownTimer) { clearInterval(retryCountdownTimer); retryCountdownTimer = null; }
    retryChatMessage();
}

async function retryChatMessage() {
    if (!lastFailedMessage) return;
    document.getElementById('chat-messages').querySelectorAll('.chat-message-error').forEach(el => el.remove());

    const sendBtn = document.getElementById('chat-send-btn');
    const input = document.getElementById('chat-text-input');
    sendBtn.disabled = true;
    input.disabled = true;
    const typingId = appendTypingIndicator();

    try {
        const reply = await callGeminiChat(lastFailedMessage);
        removeTypingIndicator(typingId);
        appendChatMessage('assistant', reply);
        lastFailedMessage = null;
    } catch (err) {
        removeTypingIndicator(typingId);
        handleChatError(err);
    } finally {
        sendBtn.disabled = false;
        input.disabled = false;
        input.focus();
    }
}

async function callGeminiChat(userMessage) {
    const contents = chatHistory.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: 'אתה עוזר חכם שמסייע למשתמשים להבין מפת מחשבה של SDLC (מחזור חיי תכנה עם סוכני AI). ענה תמיד בעברית בלבד. הנה מבנה המפה המלא:\n\n' + buildMindmapContext() }]
                },
                contents,
                generationConfig: { maxOutputTokens: 8192, temperature: 0.1 }
            })
        }
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
    }

    const data = await res.json();
    const reply = data.candidates[0].content.parts.map(p => p.text).join('');
    chatHistory.push({ role: 'user', text: userMessage });
    chatHistory.push({ role: 'model', text: reply });
    return reply;
}

// ── UI helpers ─────────────────────────────────────────────────────────────

function appendChatMessage(role, text) {
    const container = document.getElementById('chat-messages');
    const wrapper = document.createElement('div');
    wrapper.className = `chat-message chat-message-${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerHTML = formatChatText(text);
    wrapper.appendChild(bubble);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

function appendTypingIndicator() {
    const id = 'typing-' + (++typingIdCounter);
    const container = document.getElementById('chat-messages');
    const wrapper = document.createElement('div');
    wrapper.id = id;
    wrapper.className = 'chat-message chat-message-assistant';
    wrapper.innerHTML = '<div class="chat-bubble chat-typing"><span></span><span></span><span></span></div>';
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function formatChatText(text) {
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('chat-overlay').style.display === 'flex') {
        if (chatIsFullscreen) toggleChatFullscreen();
        else closeChat();
    }
});
