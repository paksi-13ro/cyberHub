const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authOptional, authRequired } = require('../middleware/auth');
const prisma = new PrismaClient();

const router = express.Router();

// ---------- Получить меню коктейлей ----------
router.get('/cocktails', async (req, res) => {
    const cocktails = await prisma.cocktail.findMany({
        orderBy: { price: 'desc' },
        include: { author: { select: { username: true } } }
    });
    res.json(cocktails.map(c => ({
        id: c.id,
        name: c.name,
        desc: c.desc,
        price: c.price,
        base: c.base,
        author: c.author?.username || 'Легенда бара'
    })));
});

// ---------- Создать коктейль ----------
router.post('/cocktails', authOptional, async (req, res) => {
    try {
        const { name, desc, price } = req.body;
        if (!name || !desc || !price) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }
        if (price < 100) return res.status(400).json({ error: 'Минимальная цена — 100 ₽' });

        const cocktail = await prisma.cocktail.create({
            data: {
                name,
                desc,
                price: parseInt(price),
                authorId: req.user?.id || null
            }
        });
        res.json(cocktail);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ---------- Сделать донат ----------
router.post('/', authOptional, async (req, res) => {
    try {
        const { name, amount, comment, cocktailId } = req.body;
        if (!name || !amount || !cocktailId) {
            return res.status(400).json({ error: 'Имя, сумма и коктейль обязательны' });
        }

        const cocktail = await prisma.cocktail.findUnique({ where: { id: cocktailId } });
        if (!cocktail) return res.status(404).json({ error: 'Коктейль не найден' });
        if (amount < cocktail.price) {
            return res.status(400).json({ error: `Минимум ${cocktail.price} ₽` });
        }

        const donation = await prisma.donation.create({
            data: {
                name,
                amount: parseInt(amount),
                comment: comment || null,
                cocktailId,
                userId: req.user?.id || null
            }
        });
        res.json(donation);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ---------- Топ-10 доноров ----------
router.get('/top', async (req, res) => {
    const donations = await prisma.donation.groupBy({
        by: ['userId', 'name'],
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
        take: 10
    });

    res.json(donations.map(d => ({
        name: d.name,
        amount: d._sum.amount,
        count: d._count
    })));
});

// ---------- Все донаты ----------
router.get('/', async (req, res) => {
    const donations = await prisma.donation.findMany({
        orderBy: { createdAt: 'desc' },
        include: { cocktail: { select: { name: true } } }
    });
    res.json(donations.map(d => ({
        id: d.id,
        name: d.name,
        amount: d.amount,
        comment: d.comment,
        cocktail: d.cocktail.name,
        createdAt: d.createdAt
    })));
});

module.exports = router;