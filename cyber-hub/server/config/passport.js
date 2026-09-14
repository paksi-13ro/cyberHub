const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const YandexTokenStrategy = require('passport-yandex-token').Strategy;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ---------- Google ----------
if (process.env.GOOGLE_CLIENT_ID) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await prisma.user.findFirst({
                where: { provider: 'google', providerId: profile.id }
            });
            if (!user) {
                // Проверяем, нет ли пользователя с таким email
                const email = profile.emails?.[0]?.value;
                if (email) {
                    user = await prisma.user.findUnique({ where: { email } });
                }
                if (user) {
                    // Привязываем Google к существующему аккаунту
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: { provider: 'google', providerId: profile.id }
                    });
                } else {
                    // Создаём нового пользователя
                    let username = profile.displayName || `user_${profile.id}`;
                    // Убедимся, что username уникален
                    const existing = await prisma.user.findUnique({ where: { username } });
                    if (existing) username = `${username}_${profile.id.slice(-4)}`;

                    user = await prisma.user.create({
                        data: {
                            username,
                            email,
                            provider: 'google',
                            providerId: profile.id,
                            avatar: profile.photos?.[0]?.value
                        }
                    });
                }
            }
            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));
}

// ---------- Yandex ----------
if (process.env.YANDEX_CLIENT_ID) {
    passport.use(new YandexTokenStrategy({
        clientID: process.env.YANDEX_CLIENT_ID,
        clientSecret: process.env.YANDEX_CLIENT_SECRET,
        passReqToCallback: true
    }, async (req, accessToken, refreshToken, profile, done) => {
        try {
            let user = await prisma.user.findFirst({
                where: { provider: 'yandex', providerId: profile.id }
            });
            if (!user) {
                const email = profile.emails?.[0]?.value;
                if (email) {
                    user = await prisma.user.findUnique({ where: { email } });
                }
                if (user) {
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: { provider: 'yandex', providerId: profile.id }
                    });
                } else {
                    let username = profile.displayName || `yandex_${profile.id}`;
                    const existing = await prisma.user.findUnique({ where: { username } });
                    if (existing) username = `${username}_${profile.id.slice(-4)}`;

                    user = await prisma.user.create({
                        data: {
                            username,
                            email,
                            provider: 'yandex',
                            providerId: profile.id,
                            avatar: profile.photos?.[0]?.value
                        }
                    });
                }
            }
            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));
}

module.exports = passport;