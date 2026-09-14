function isAdmin(req, res, next) {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ error: 'Доступ только для администратора' });
    }
    next();
}

module.exports = { isAdmin };