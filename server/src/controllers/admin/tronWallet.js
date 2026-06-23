const { Router } = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { adminAuth } = require('../../middleware/auth');
const { adminLimiter } = require('../../middleware/rateLimiter');
const { validateBody } = require('../../middleware/validator');
const { isTronAddress } = require('../../services/tronWallet');
const logger = require('../../utils/logger');

const prisma = new PrismaClient();
const router = Router();
router.use(adminAuth, adminLimiter);
const walletSchema = z.object({ address: z.string().trim().refine(isTronAddress, 'TRON 地址格式不正确'), label: z.string().trim().max(80).optional().default(''), status: z.enum(['active', 'inactive']).default('active'), priority: z.number().int().min(-100).max(100).default(0) });
const updateSchema = walletSchema.partial().refine((value) => Object.keys(value).length > 0, '没有可更新字段');

router.get('/tron-wallets', async (req, res, next) => {
  try {
    const items = await prisma.tronWallet.findMany({ orderBy: [{ priority: 'desc' }, { lastAssignedAt: 'asc' }, { id: 'asc' }], include: { _count: { select: { orders: true, topUps: true } } } });
    res.json({ items });
  } catch (err) { next(err); }
});
router.post('/tron-wallets', validateBody(walletSchema), async (req, res, next) => {
  try {
    const item = await prisma.tronWallet.create({ data: req.body });
    logger.info('TRON wallet created', { id: item.id, adminId: req.admin.id });
    res.status(201).json(item);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: '该收款地址已存在' });
    next(err);
  }
});
router.put('/tron-wallets/:id', validateBody(updateSchema), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const item = await prisma.tronWallet.update({ where: { id }, data: req.body });
    logger.info('TRON wallet updated', { id, adminId: req.admin.id });
    res.json(item);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: '收款地址不存在' });
    if (err.code === 'P2002') return res.status(409).json({ error: '该收款地址已存在' });
    next(err);
  }
});
module.exports = router;
