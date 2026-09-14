const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authRequired } = require('../middleware/auth');
const prisma = new PrismaClient();

const router = express.Router();

// ---------- Получить свой профиль ----------
router.get('/me', authRequired, async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
            isAdmin: true,
            provider: true,
            createdAt: true,
            _count: { select: { favorites: true, sheets: true } }
        }
    });
    res.json(user);
});

// ---------- Сменить логин ----------
router.patch('/me/username', authRequired, async (req, res) => {
    try {
        const { newUsername, password } = req.body;
        if (!newUsername || !password) {
            return res.status(400).json({ error: 'Новый логин и пароль обязательны' });
        }
        if (newUsername.length < 3 || newUsername.length > 20) {
            return res.status(400).json({ error: 'Логин: от 3 до 20 символов' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user.password) {
            return res.status(400).json({ error: 'Смена логина недоступна для OAuth-аккаунтов' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Неверный пароль' });
        }

        const existing = await prisma.user.findUnique({ where: { username: newUsername } });
        if (existing) {
            return res.status(400).json({ error: 'Такой логин уже занят' });
        }

        const updated = await prisma.user.update({
            where: { id: user.id },
            data: { username: newUsername },
            select: { id: true, username: true }
        });
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ---------- Сменить пароль ----------
router.patch('/me/password', authRequired, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: 'Старый и новый пароль обязательны' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Пароль: минимум 6 символов' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user.password) {
            return res.status(400).json({ error: 'Смена пароля недоступна для OAuth-аккаунтов' });
        }

        const valid = await bcrypt.compare(oldPassword, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Неверный текущий пароль' });
        }

        const hash = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({ where: { id: user.id }, data: { password: hash } });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ---------- Получить избранное ----------
router.get('/me/favorites', authRequired, async (req, res) => {
    const favorites = await prisma.favorite.findMany({
        where: { userId: req.user.id },
        include: { material: true },
        orderBy: { createdAt: 'desc' }
    });
    res.json(favorites.map(f => f.material));
});

module.exports = router;