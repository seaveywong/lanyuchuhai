const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { adminAuth } = require('../../middleware/auth');
const { validateBody } = require('../../middleware/validator');
const { adminLimiter } = require('../../middleware/rateLimiter');
const { creditUser } = require('../../services/wallet');
const logger = require('../../utils/logger');

const prisma = new PrismaClient();
const router = Router();
router.use(adminAuth, adminLimiter);
const creditSchema = z.object({ userId: z.number().int().positive(), amount: z.number().positive().max(100000), type: z.enum(['manual_credit', 'promotional_credit', 'support_compensation']), note: z.string().trim().min(2).max(300), password: z.string().min(1).max(128) });

router.get('/wallet/users', async (req, res, next) => {
  try {
    const query = String(req.query.query || '').trim().toLowerCase();
    if (query.length < 2) return res.json({ items: [] });
    const items = await prisma.user.findMany({ where: { email: { contains: query } }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, email: true, balanceCents: true, status: true, createdAt: true } });
    res.json({ items });
  } catch (err) { next(err); }
});

router.get('/wallet/ledger', async (req, res, next) => {
  try {
    const entries = await prisma.walletLedger.findMany({ orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, amountCents: true, balanceAfterCents: true, type: true, note: true, createdAt: true, user: { select: { email: true } }, admin: { select: { username: true } }, order: { select: { orderNo: true } } } });
    res.json({ entries });
  } catch (err) { next(err); }
});

router.post('/wallet/credit', validateBody(creditSchema), async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUnique({ where: { id: req.admin.id }, select: { id: true, passwordHash: true } });
    if (!admin || !(await bcrypt.compare(req.body.password, admin.passwordHash))) return res.status(403).json({ error: '管理员密码验证失败' });
    const ledger = await creditUser({ userId: req.body.userId, amount: req.body.amount, type: req.body.type, note: req.body.note, adminId: req.admin.id });
    await prisma.auditLog.create({ data: { adminId: req.admin.id, action: 'wallet_manual_credit', target: String(req.body.userId), detail: JSON.stringify({ amountCents: ledger.amountCents, type: ledger.type, ledgerId: ledger.id }), ip: req.ip } });
    logger.info('Wallet manually credited', { adminId: req.admin.id, userId: req.body.userId, amountCents: ledger.amountCents, type: ledger.type });
    res.json({ success: true, ledger });
  } catch (err) { next(err); }
});

module.exports = router;
