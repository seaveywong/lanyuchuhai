const { Router } = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { adminAuth } = require('../../middleware/auth');
const { validateBody } = require('../../middleware/validator');
const { adminLimiter } = require('../../middleware/rateLimiter');
const { appendLedger, toCents } = require('../../services/wallet');
const { AppError } = require('../../middleware/errorHandler');
const logger = require('../../utils/logger');

const prisma = new PrismaClient();
const router = Router();
router.use(adminAuth, adminLimiter);
const verifySchema = z.object({ password: z.string().min(1).max(128) });
const creditSchema = z.object({ userId: z.number().int().positive(), amount: z.number().positive().max(100000), type: z.enum(['manual_credit', 'promotional_credit', 'support_compensation']), note: z.string().trim().min(2).max(300), actionToken: z.string().min(32).max(256) });

router.get('/wallet/users', async (req, res, next) => {
  try {
    const query = String(req.query.query || '').trim().toLowerCase();
    const where = query.length >= 2 ? { email: { contains: query } } : {};
    const items = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, email: true, balanceCents: true, status: true, emailVerifiedAt: true, createdAt: true } });
    res.json({ items });
  } catch (err) { next(err); }
});

router.get('/wallet/ledger', async (req, res, next) => {
  try {
    const entries = await prisma.walletLedger.findMany({ orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, amountCents: true, balanceBeforeCents: true, balanceAfterCents: true, type: true, note: true, createdAt: true, user: { select: { email: true } }, admin: { select: { username: true } }, order: { select: { orderNo: true } } } });
    res.json({ entries });
  } catch (err) { next(err); }
});

router.post('/wallet/verify-credit', validateBody(verifySchema), async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUnique({ where: { id: req.admin.id }, select: { id: true, passwordHash: true } });
    if (!admin || !(await bcrypt.compare(req.body.password, admin.passwordHash))) return res.status(403).json({ error: '管理员密码验证失败' });
    const actionToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await prisma.adminSensitiveAction.create({ data: { adminId: admin.id, action: 'wallet_credit', tokenHash: crypto.createHash('sha256').update(actionToken).digest('hex'), expiresAt } });
    await prisma.auditLog.create({ data: { adminId: admin.id, action: 'wallet_credit_verified', ip: req.ip } });
    res.json({ actionToken, expiresAt });
  } catch (err) { next(err); }
});

router.post('/wallet/credit', validateBody(creditSchema), async (req, res, next) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(req.body.actionToken).digest('hex');
    const ledger = await prisma.$transaction(async (tx) => {
      const ticket = await tx.adminSensitiveAction.findFirst({ where: { adminId: req.admin.id, action: 'wallet_credit', tokenHash, usedAt: null, expiresAt: { gt: new Date() } } });
      if (!ticket) throw new AppError('敏感操作凭证无效、已使用或已过期，请重新验证密码', 403);
      const claimed = await tx.adminSensitiveAction.updateMany({ where: { id: ticket.id, usedAt: null }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw new AppError('敏感操作凭证已使用，请重新验证密码', 403);
      const created = await appendLedger(tx, { userId: req.body.userId, amountCents: toCents(req.body.amount), type: req.body.type, note: req.body.note, adminId: req.admin.id });
      await tx.auditLog.create({ data: { adminId: req.admin.id, action: 'wallet_manual_credit', target: String(req.body.userId), detail: JSON.stringify({ amountCents: created.amountCents, balanceBeforeCents: created.balanceBeforeCents, balanceAfterCents: created.balanceAfterCents, type: created.type, ledgerId: created.id }), ip: req.ip } });
      return created;
    });
    logger.info('Wallet manually credited', { adminId: req.admin.id, userId: req.body.userId, amountCents: ledger.amountCents, type: ledger.type });
    res.json({ success: true, ledger });
  } catch (err) { next(err); }
});

module.exports = router;
