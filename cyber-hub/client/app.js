// ============================================================
//  CYBER HUB — общий клиентский скрипт (работа с API)
// ============================================================

// ---------- API-клиент ----------
const API_BASE = '/api';

const api = {
    async request(path, options = {}) {
        const res = await fetch(`${API_BASE}${path}`, {
            credentials: 'include',
            headers: {
                ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
                ...(options.headers || {})
            },
            ...options
        });

        let data = null;
        try { data = await res.json(); } catch {}

        if (!res.ok) {
            const err = new Error(data?.error || `HTTP ${res.status}`);
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    },
    get(path) { return this.request(path); },
    post(path, body) {
        return this.request(path, {
            method: 'POST',
            body: body instanceof FormData ? body : JSON.stringify(body)
        });
    },
    patch(path, body) {
        return this.request(path, { method: 'PATCH', body: JSON.stringify(body) });
    },
    put(path, body) {
        return this.request(path, { method: 'PUT', body: JSON.stringify(body) });
    },
    delete(path) { return this.request(path, { method: 'DELETE' }); }
};

// ---------- Состояние ----------
let CURRENT_USER = null;

// ---------- Загрузка сессии ----------
async function loadSession() {
    try {
        CURRENT_USER = await api.get('/users/me');
    } catch {
        CURRENT_USER = null;
    }
}

// ---------- Аутентификация ----------
async function login(username, password) {
    const data = await api.post('/auth/login', { username, password });
    CURRENT_USER = data.user;
    return data;
}

async function register(username, password) {
    const data = await api.post('/auth/register', { username, password });
    CURRENT_USER = data.user;
    return data;
}

async function logout() {
    try { await api.post('/auth/logout'); } catch {}
    CURRENT_USER = null;
}

// ---------- Хедер и навигация ----------
const NAV_ITEMS = [
    { href: 'index.html',      label: 'Главная' },
    { href: 'materials.html',  label: 'Материалы' },
    { href: 'characters.html', label: 'Листы персонажа' },
    { href: 'bar.html',        label: 'Бар' },
    { href: 'account.html',    label: 'Аккаунт' },
];

function renderHeader() {
    const path = location.pathname.split('/').pop() || 'index.html';

    const navHtml = NAV_ITEMS.map(item => {
        const active = item.href === path ? ' class="active"' : '';
        return `<a href="${item.href}"${active}>${item.label}</a>`;
    }).join('');

    const userHtml = CURRENT_USER
        ? `<div class="user-chip">
             <span>${escapeHtml(CURRENT_USER.username)}${CURRENT_USER.isAdmin ? ' ★' : ''}</span>
             <a href="#" id="logout-btn">Выйти</a>
           </div>`
        : `<div class="user-chip" style="border-color:var(--neon-cyan);color:var(--neon-cyan);box-shadow:0 0 8px rgba(0,229,255,.25)">
             <a href="account.html" style="color:var(--neon-cyan)">Войти</a>
           </div>`;

    // Удаляем старый хедер, если он есть (на случай повторного вызова)
    const old = document.querySelector('header.site-header');
    if (old) old.remove();

    const header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML = `
        <div class="header-inner">
            <a href="index.html" class="logo">CYBER<span>HUB</span></a>
            <nav class="main-nav">${navHtml}</nav>
            ${userHtml}
        </div>
    `;
    document.body.prepend(header);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', async e => {
        e.preventDefault();
        await logout();
        toast('Сессия завершена. Возвращайся, чум.', 'success');
        setTimeout(() => location.href = 'index.html', 500);
    });
}

// ---------- Toast ----------
function toast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
        el.style.transition = 'opacity .4s, transform .4s';
        el.style.opacity = '0';
        el.style.transform = 'translateX(30px)';
        setTimeout(() => el.remove(), 400);
    }, 3200);
}

// ---------- Утилиты ----------
function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
}
function formatDate(ts) {
    return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatMoney(n) {
    return new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
}
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / 1024 / 1024).toFixed(2) + ' МБ';
}

// ============================================================
//  ВАЖНО: автоинициализации здесь НЕТ.
//  Каждая HTML-страница сама вызывает loadSession() и renderHeader()
//  внутри своего initXxxPage() на DOMContentLoaded.
// ============================================================