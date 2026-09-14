const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authRequired } = require('../middleware/auth');
const { isAdmin } = require('../middleware/isAdmin');
const prisma = new PrismaClient();

const router = express.Router();

// Все роуты требуют прав администратора
router.use(authRequired, isAdmin);

// ---------- Список всех пользователей ----------
router.get('/users', async (req, res) => {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            username: true,
            email: true,
            isAdmin: true,
            provider: true,
            createdAt: true,
            _count: { select: { favorites: true, sheets: true, donations: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    res.json(users);
});

// ---------- Удалить пользователя ----------
router.delete('/users/:id', async (req, res) => {
    try {
        if (req.params.id === req.user.id) {
            return res.status(400).json({ error: 'Нельзя удалить самого себя' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        // Каскадное удаление избранного и листов настроено в схеме
        await prisma.user.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ---------- Назначить/снять администратора ----------
router.patch('/users/:id/role', async (req, res) => {
    try {
        const { isAdmin } = req.body;
        if (req.params.id === req.user.id) {
            return res.status(400).json({ error: 'Нельзя изменить свою роль' });
        }

        const updated = await prisma.user.update({
            where: { id: req.params.id },
            data: { isAdmin: Boolean(isAdmin) },
            select: { id: true, username: true, isAdmin: true }
        });
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;