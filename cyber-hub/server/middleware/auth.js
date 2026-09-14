const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Проверка JWT-токена
async function authRequired(req, res, next) {
    try {
        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Требуется авторизация' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, username: true, email: true, isAdmin: true, avatar: true }
        });
        if (!user) {
            return res.status(401).json({ error: 'Пользователь не найден' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Недействительный токен' });
    }
}

// Опциональная авторизация (не блокирует, но добавляет req.user)
async function authOptional(req, res, next) {
    try {
        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
        if (!token) return next();
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, username: true, email: true, isAdmin: true, avatar: true }
        });
        if (user) req.user = user;
        next();
    } catch {
        next();
    }
}

module.exports = { authRequired, authOptional };