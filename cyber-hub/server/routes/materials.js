const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { authRequired, authOptional } = require('../middleware/auth');
const { isAdmin } = require('../middleware/isAdmin');
const prisma = new PrismaClient();

const router = express.Router();

// ---------- Настройка multer ----------
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
        cb(null, name);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 }
});

// ---------- Получить все материалы ----------
router.get('/', authOptional, async (req, res) => {
    const materials = await prisma.material.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            author: { select: { username: true } },
            _count: { select: { favorites: true } }
        }
    });

    // Если пользователь авторизован, добавляем флаг "в избранном"
    let favoriteIds = [];
    if (req.user) {
        const favs = await prisma.favorite.findMany({
            where: { userId: req.user.id },
            select: { materialId: true }
        });
        favoriteIds = favs.map(f => f.materialId);
    }

    res.json(materials.map(m => ({
        id: m.id,
        title: m.title,
        category: m.category,
        description: m.description,
        fileUrl: m.fileUrl,
        fileSize: m.fileSize,
        author: m.author.username,
        createdAt: m.createdAt,
        favoritesCount: m._count.favorites,
        isFavorite: favoriteIds.includes(m.id)
    })));
});

// ---------- Создать материал (только админ) ----------
router.post('/', authRequired, isAdmin, upload.single('file'), async (req, res) => {
    try {
        const { title, category, description } = req.body;
        if (!title || !description) {
            return res.status(400).json({ error: 'Название и описание обязательны' });
        }

        const material = await prisma.material.create({
            data: {
                title,
                category: category || 'прочее',
                description,
                fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
                fileSize: req.file ? req.file.size : null,
                authorId: req.user.id
            }
        });

        res.json(material);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ---------- Удалить материал (только админ) ----------
router.delete('/:id', authRequired, isAdmin, async (req, res) => {
    try {
        const material = await prisma.material.findUnique({ where: { id: req.params.id } });
        if (!material) return res.status(404).json({ error: 'Материал не найден' });

        // Удаляем файл с диска
        if (material.fileUrl) {
            const filePath = path.join(__dirname, '..', material.fileUrl);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        await prisma.material.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ---------- Переключить избранное ----------
router.post('/:id/favorite', authRequired, async (req, res) => {
    try {
        const existing = await prisma.favorite.findUnique({
            where: { userId_materialId: { userId: req.user.id, materialId: req.params.id } }
        });

        if (existing) {
            await prisma.favorite.delete({ where: { id: existing.id } });
            res.json({ ok: true, isFavorite: false });
        } else {
            await prisma.favorite.create({
                data: { userId: req.user.id, materialId: req.params.id }
            });
            res.json({ ok: true, isFavorite: true });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;