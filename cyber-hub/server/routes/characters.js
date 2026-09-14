const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authRequired } = require('../middleware/auth');
const prisma = new PrismaClient();

const router = express.Router();

// ---------- Мои листы ----------
router.get('/', authRequired, async (req, res) => {
    const sheets = await prisma.characterSheet.findMany({
        where: { userId: req.user.id },
        orderBy: { updatedAt: 'desc' }
    });
    res.json(sheets);
});

// ---------- Создать лист ----------
router.post('/', authRequired, async (req, res) => {
    try {
        const { name, data } = req.body;
        if (!name) return res.status(400).json({ error: 'Имя персонажа обязательно' });

        const sheet = await prisma.characterSheet.create({
            data: { userId: req.user.id, name, data: data || {} }
        });
        res.json(sheet);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ---------- Обновить лист ----------
router.put('/:id', authRequired, async (req, res) => {
    try {
        const sheet = await prisma.characterSheet.findUnique({ where: { id: req.params.id } });
        if (!sheet || sheet.userId !== req.user.id) {
            return res.status(404).json({ error: 'Лист не найден' });
        }

        const { name, data } = req.body;
        const updated = await prisma.characterSheet.update({
            where: { id: sheet.id },
            data: { name: name ?? sheet.name, data: data ?? sheet.data }
        });
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ---------- Удалить лист ----------
router.delete('/:id', authRequired, async (req, res) => {
    try {
        const sheet = await prisma.characterSheet.findUnique({ where: { id: req.params.id } });
        if (!sheet || sheet.userId !== req.user.id) {
            return res.status(404).json({ error: 'Лист не найден' });
        }
        await prisma.characterSheet.delete({ where: { id: sheet.id } });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;