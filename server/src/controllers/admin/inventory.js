
const { Router } = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { adminAuth } = require('../../middleware/auth');
const { validateBody } = require('../../middleware/validator');
const { adminLimiter } = require('../../middleware/rateLimiter');
const cardService = require('../../services/card');
const { hash } = require('../../utils/crypto');
const logger = require('../../utils/logger');

const prisma = new PrismaClient();
const router = Router();
router.use(adminAuth, adminLimiter);

const inventorySelect = {
  id: true,
  productId: true,
  cardContentHash: true,
  status: true,
  orderItemId: true,
  createdAt: true,
  soldAt: true,
  product: { select: { id: true, name: true, price: true, status: true } },
  orderItem: { select: { order: { select: { orderNo: true } } } },
};

router.get('/inventory/stats', async (req, res, next) => {
  try {
    const stats = await prisma.inventory.groupBy({ by: ['status'], _count: true });
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get('/inventory', async (req, res, next) => {
  try {
    const { productId, status, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 500);
    const where = {};
    if (productId) where.productId = parseInt(productId, 10);
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.inventory.findMany({ where, select: inventorySelect, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.inventory.count({ where }),
    ]);

    res.json({
      items: items.map((item) => ({ ...item, shortHash: item.cardContentHash.slice(0, 12) })),
      pagination: { page: parseInt(page, 10), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (err) {
    next(err);
  }
});

const importSchema = z.object({
  productId: z.number().int().positive(),
  cards: z.array(z.string().min(1)).min(1, '至少导入一条').max(1000, '单次最多 1000 条'),
  skipDuplicates: z.boolean().default(true),
});

router.post('/inventory/batch-import', validateBody(importSchema), async (req, res, next) => {
  try {
    const { productId, cards, skipDuplicates } = req.body;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ error: '商品不存在' });

    const result = await cardService.batchImport(productId, cards, skipDuplicates);
    logger.info('Inventory batch import', { productId, productName: product.name, imported: result.imported, skipped: result.skipped, adminId: req.admin.id });
    res.json({ message: '成功导入 ' + result.imported + ' 条，跳过 ' + result.skipped + ' 条重复', ...result });
  } catch (err) {
    next(err);
  }
});

const inventorySearchSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('orderNo'), query: z.string().trim().min(1).max(128) }),
  z.object({ type: z.literal('cardContent'), query: z.string().trim().min(1).max(16384) }),
]);

router.post('/inventory/search', validateBody(inventorySearchSchema), async (req, res, next) => {
  try {
    const query = req.body.query.trim();
    const where = req.body.type === 'orderNo'
      ? { orderItem: { is: { order: { is: { orderNo: query } } } } }
      : { cardContentHash: hash(query) };
    const items = await prisma.inventory.findMany({
      where,
      select: inventorySelect,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    logger.info('Inventory exact search', { type: req.body.type, resultCount: items.length, adminId: req.admin.id });
    res.json({
      items: items.map((item) => ({ ...item, shortHash: item.cardContentHash.slice(0, 12) })),
      total: items.length,
    });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  productId: z.number().int().positive().optional(),
  status: z.enum(['available', 'reserved']).optional(),
  cardContent: z.string().trim().min(1).optional(),
});

router.put('/inventory/:id', validateBody(updateSchema), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const current = await prisma.inventory.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: '库存不存在' });
    if (current.status === 'sold') return res.status(400).json({ error: '已售出的库存不能修改' });

    const data = {};
    if (req.body.productId) {
      const product = await prisma.product.findUnique({ where: { id: req.body.productId } });
      if (!product) return res.status(404).json({ error: '商品不存在' });
      data.productId = req.body.productId;
    }
    if (req.body.status) data.status = req.body.status;
    if (req.body.cardContent) Object.assign(data, await cardService.buildEncryptedCardData(req.body.cardContent, id));

    const item = await prisma.inventory.update({ where: { id }, data, select: inventorySelect });
    logger.info('Inventory updated', { id, adminId: req.admin.id });
    res.json({ ...item, shortHash: item.cardContentHash.slice(0, 12) });
  } catch (err) {
    next(err);
  }
});

router.delete('/inventory/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const current = await prisma.inventory.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: '库存不存在' });
    if (current.status === 'sold' || current.orderItemId) return res.status(400).json({ error: '已售出的库存不能删除' });

    await prisma.inventory.delete({ where: { id } });
    logger.info('Inventory deleted', { id, adminId: req.admin.id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

const batchDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, '请选择库存').max(500, '单次最多删除 500 条'),
});

router.post('/inventory/batch-delete', validateBody(batchDeleteSchema), async (req, res, next) => {
  try {
    const ids = Array.from(new Set(req.body.ids));
    const rows = await prisma.inventory.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true, orderItemId: true },
    });
    const deletableIds = rows.filter((item) => item.status !== 'sold' && !item.orderItemId).map((item) => item.id);
    const skippedIds = rows.filter((item) => item.status === 'sold' || item.orderItemId).map((item) => item.id);

    let deleted = 0;
    if (deletableIds.length) {
      const result = await prisma.inventory.deleteMany({
        where: { id: { in: deletableIds }, status: { not: 'sold' }, orderItemId: null },
      });
      deleted = result.count;
    }

    logger.info('Inventory batch deleted', { requested: ids.length, deleted, skipped: skippedIds.length, adminId: req.admin.id });
    res.json({ success: true, requested: ids.length, deleted, skipped: skippedIds.length, skippedIds });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
