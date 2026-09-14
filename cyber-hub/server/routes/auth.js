const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const passport = require('../config/passport');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// ---------- Утилита: генерация JWT ----------
function generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
}

// ---------- Утилита: установка cookie ----------
function setTokenCookie(res, token) {
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
    });
}

// ============================================================
//  РЕГИСТРАЦИЯ
// ============================================================
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Логин и пароль обязательны' });
        }
        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ error: 'Логин: от 3 до 20 символов' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль: минимум 6 символов' });
        }

        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
            return res.status(400).json({ error: 'Такой логин уже занят' });
        }

        const hash = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: { username, password: hash },
            select: { id: true, username: true, isAdmin: true, createdAt: true }
        });

        const token = generateToken(user.id);
        setTokenCookie(res, token);
        res.json({ user, token });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================================
//  ВХОД
// ============================================================
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Логин и пароль обязательны' });
        }

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user || !user.password) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        const token = generateToken(user.id);
        setTokenCookie(res, token);
        res.json({
            user: { id: user.id, username: user.username, isAdmin: user.isAdmin },
            token
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================================
//  ВЫХОД
// ============================================================
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ ok: true });
});

// ============================================================
//  GOOGLE OAUTH
// ============================================================
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/account.html' }),
    (req, res) => {
        const token = generateToken(req.user.id);
        setTokenCookie(res, token);
        res.redirect(`${process.env.CLIENT_URL}/account.html?oauth=google`);
    }
);

// ============================================================
//  YANDEX OAUTH
// ============================================================
router.get('/yandex', passport.authenticate('yandex-token'));

router.get('/yandex/callback',
    passport.authenticate('yandex-token', { session: false, failureRedirect: '/account.html' }),
    (req, res) => {
        const token = generateToken(req.user.id);
        setTokenCookie(res, token);
        res.redirect(`${process.env.CLIENT_URL}/account.html?oauth=yandex`);
    }
);

// ============================================================
//  VK OAUTH (OAuth 2.1 + PKCE)
// ============================================================
router.get('/vk', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');

    // Сохраняем в cookie для проверки на callback
    res.cookie('vk_state', state, { httpOnly: true, maxAge: 10 * 60 * 1000 });
    res.cookie('vk_code_verifier', codeVerifier, { httpOnly: true, maxAge: 10 * 60 * 1000 });

    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.VK_APP_ID,
        redirect_uri: process.env.VK_REDIRECT_URL,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        scope: 'email phone'
    });

    res.redirect(`https://id.vk.com/authorize?${params}`);
});

router.get('/vk/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        const savedState = req.cookies?.vk_state;
        const codeVerifier = req.cookies?.vk_code_verifier;

        if (!code || state !== savedState || !codeVerifier) {
            return res.redirect(`${process.env.CLIENT_URL}/account.html?error=vk_state`);
        }

        // Обмен кода на токен
        const tokenRes = await fetch('https://id.vk.com/oauth2/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: process.env.VK_APP_ID,
                client_secret: process.env.VK_CLIENT_SECRET,
                redirect_uri: process.env.VK_REDIRECT_URL,
                code_verifier: codeVerifier
            })
        });

        const tokenData = await tokenRes.json();
        if (tokenData.error) {
            console.error('VK token error:', tokenData);
            return res.redirect(`${process.env.CLIENT_URL}/account.html?error=vk_token`);
        }

        // Получение информации о пользователе
        const userRes = await fetch(
            `https://id.vk.com/oauth2/user_info?access_token=${tokenData.access_token}&client_id=${process.env.VK_APP_ID}`
        );
        const userData = await userRes.json();
        const vkUser = userData.user;

        if (!vkUser) {
            return res.redirect(`${process.env.CLIENT_URL}/account.html?error=vk_user`);
        }

        // Создание или поиск пользователя
        let user = await prisma.user.findFirst({
            where: { provider: 'vk', providerId: String(vkUser.user_id) }
        });

        if (!user) {
            const email = vkUser.email || null;
            if (email) {
                user = await prisma.user.findUnique({ where: { email } });
            }
            if (user) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { provider: 'vk', providerId: String(vkUser.user_id) }
                });
            } else {
                let username = vkUser.first_name
                    ? `${vkUser.first_name}_${vkUser.last_name || ''}`.trim()
                    : `vk_${vkUser.user_id}`;

                const existing = await prisma.user.findUnique({ where: { username } });
                if (existing) username = `${username}_${vkUser.user_id}`;

                user = await prisma.user.create({
                    data: {
                        username,
                        email,
                        provider: 'vk',
                        providerId: String(vkUser.user_id),
                        avatar: vkUser.avatar
                    }
                });
            }
        }

        const token = generateToken(user.id);
        setTokenCookie(res, token);
        res.redirect(`${process.env.CLIENT_URL}/account.html?oauth=vk`);
    } catch (err) {
        console.error('VK callback error:', err);
        res.redirect(`${process.env.CLIENT_URL}/account.html?error=vk`);
    }
});

// ============================================================
//  ВОССТАНОВЛЕНИЕ ПАРОЛЯ
// ============================================================
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email обязателен' });

        const user = await prisma.user.findUnique({ where: { email } });
        // Всегда отвечаем успешно, чтобы не раскрывать существование email
        if (!user) {
            return res.json({ ok: true, message: 'Если email зарегистрирован, письмо отправлено' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        await prisma.passwordReset.create({
            data: {
                userId: user.id,
                token,
                expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 час
            }
        });

        // TODO: Отправка email (см. раздел 4.4)
        console.log(`📧 Password reset link: ${process.env.CLIENT_URL}/recover.html?token=${token}`);

        res.json({ ok: true, message: 'Если email зарегистрирован, письмо отправлено' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Токен и новый пароль обязательны' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Пароль: минимум 6 символов' });
        }

        const reset = await prisma.passwordReset.findUnique({ where: { token } });
        if (!reset || reset.used || reset.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Токен недействителен или истёк' });
        }

        const hash = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: reset.userId },
            data: { password: hash }
        });
        await prisma.passwordReset.update({
            where: { id: reset.id },
            data: { used: true }
        });

        res.json({ ok: true });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;