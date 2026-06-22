const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const config = require('../../config');
const { validateBody } = require('../../middleware/validator');
const { adminLoginLimiter } = require('../../middleware/rateLimiter');
const { isBlocked, isLockedOut, recordAttempt, MAX_ATTEMPTS, LOCKOUT_MINUTES } = require('../../middleware/bruteForce');
const { adminAuth } = require('../../middleware/auth');
const logger = require('../../utils/logger');

const prisma = new PrismaClient();
const router = Router();
const DUMMY_BCRYPT_HASH = '$2a$12$Vf7tYp9B8gJ1pQaR8Vb9rOPl7ElwcWz2i3vKVv5wCS0qK2im5Y.Hu';

const loginSchema = z.object({
  username: z.string().trim().min(1).max(50).regex(/^[a-zA-Z0-9_.@-]+$/, '用户名格式不正确'),
  password: z.string().min(8, '密码至少8位').max(128),
});

function signAccessToken(admin) {
  return jwt.sign(
    { id: admin.id, username: admin.username, role: admin.role, type: 'admin' },
    config.jwt.accessSecret,
    {
      algorithm: 'HS256',
      expiresIn: config.jwt.accessExpires,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      jwtid: crypto.randomUUID(),
    }
  );
}

function signRefreshToken(admin) {
  return jwt.sign(
    { id: admin.id, type: 'admin_refresh' },
    config.jwt.refreshSecret,
    {
      algorithm: 'HS256',
      expiresIn: config.jwt.refreshExpires,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      jwtid: crypto.randomUUID(),
    }
  );
}

router.post('/login', adminLoginLimiter, validateBody(loginSchema), async (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress;

  try {
    if (await isBlocked(ip)) {
      logger.warn('Blocked IP tried to login', { ip });
      return res.status(403).json({ error: 'IP已被临时限制，请稍后再试', code: 'IP_BLOCKED' });
    }

    if (await isLockedOut(ip)) {
      logger.warn('Locked out IP tried to login', { ip });
      return res.status(429).json({
        error: `连续${MAX_ATTEMPTS}次登录失败，请${LOCKOUT_MINUTES}分钟后再试`,
        code: 'ACCOUNT_LOCKED',
      });
    }

    const { username, password } = req.body;
    const admin = await prisma.admin.findUnique({ where: { username } });

    const hashToCheck = admin ? admin.passwordHash : DUMMY_BCRYPT_HASH;
    const valid = await bcrypt.compare(password, hashToCheck);

    if (!admin || !valid) {
      await recordAttempt(ip, username, false);
      logger.warn('Admin login failed', { username, ip });
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    await recordAttempt(ip, username, true);

    const accessToken = signAccessToken(admin);
    const refreshToken = signRefreshToken(admin);

    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() },
    });

    await prisma.auditLog.create({
      data: { adminId: admin.id, action: 'login', detail: '管理员登录', ip },
    });

    logger.info('Admin logged in', { username, ip });

    res.json({
      accessToken,
      refreshToken,
      admin: { id: admin.id, username: admin.username, role: admin.role },
    });
  } catch (err) {
    next(err);
  }
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(4096),
});

router.post('/refresh', validateBody(refreshSchema), async (req, res, next) => {
  try {
    const decoded = jwt.verify(req.body.refreshToken, config.jwt.refreshSecret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });

    if (decoded.type !== 'admin_refresh') return res.status(403).json({ error: '无效的 token' });

    const admin = await prisma.admin.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, role: true },
    });
    if (!admin) return res.status(403).json({ error: '用户不存在' });

    res.json({ accessToken: signAccessToken(admin) });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '令牌已过期，请重新登录' });
    }
    next(err);
  }
});

router.get('/me', adminAuth, async (req, res) => {
  res.json({ admin: req.admin });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().min(6, '新密码至少6位').max(100),
});
router.post('/change-password', adminAuth, validateBody(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await prisma.admin.findUnique({ where: { id: req.admin.id } });
    const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!valid) return res.status(400).json({ error: '当前密码错误' });

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.admin.update({ where: { id: req.admin.id }, data: { passwordHash: hash } });
    await prisma.auditLog.create({ data: { adminId: req.admin.id, action: 'change_password', ip: req.ip } });
    logger.info('Admin password changed', { username: admin.username, ip: req.ip });
    res.json({ success: true, message: '密码已修改' });
  } catch (err) { next(err); }
});

module.exports = router;
