// ============================================================
//  CYBER HUB — точка входа сервера
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Импорт роутов
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const materialRoutes = require('./routes/materials');
const characterRoutes = require('./routes/characters');
const donationRoutes = require('./routes/donations');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Защита от брутфорса на auth-эндпоинтах
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 20, // максимум 20 запросов с одного IP
    message: { error: 'Слишком много попыток. Попробуйте позже.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ---------- Статика (фронтенд) ----------
app.use(express.static(path.join(__dirname, '..', 'client')));

// Папка для загруженных файлов
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------- API роуты ----------
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/admin', adminRoutes);

// ---------- Health check ----------
app.get('/api/health', (req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
});

// ---------- Fallback для SPA (все не-API запросы отдают index.html) ----------
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
        res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
    }
});

// ---------- Запуск ----------
app.listen(PORT, () => {
    console.log(`\n🚀 Cyber HUB server запущен на порту ${PORT}`);
    console.log(`   Режим: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   URL: http://localhost:${PORT}\n`);
});