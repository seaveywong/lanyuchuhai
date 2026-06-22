/**
 * 管理接口 — 库存（卡密）管理
 */
const { Router } = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { adminAuth } = require('../../middleware/auth');
const { validateBody } = require('../../middleware/validator');
const { adminLimiter } = require('../../middleware/rateLimiter');
const cardService = require('../../services/card');
const logger = require('../../utils/logger');

const prisma = new PrismaClient();
const router = Router();
router.use(adminAuth, adminLimiter);

// GET /api/admin/inventory?productId=&status=&page=1&limit=50
router.get('/inventory', async (req, res, next) => {
  try {
    const { productId, status, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 200);

    const where = {};
    if (productId) where.productId = parseInt(productId);
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        select: {
          id: true,
          productId: true,
          cardContentHash: true, // 只返回哈希，不返回卡密内容
          cardContentEncrypted: false, // 管理列表也不返回加密内容
          status: true,
          orderItemId: true,
          createdAt: true,
          soldAt: true,
          product: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.inventory.count({ where }),
    ]);

    res.json({
      items,
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/inventory/batch-import — 批量导入卡密
const importSchema = z.object({
  productId: z.number().int().positive(),
  cards: z.array(z.string().min(1)).min(1, '至少导入一条').max(1000, '单次最多1000条'),
  skipDuplicates: z.boolean().default(true),
});

router.post('/inventory/batch-import', validateBody(importSchema), async (req, res, next) => {
  try {
    const { productId, cards, skipDuplicates } = req.body;

    // 校验商品存在
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: '商品不存在' });
    }

    const result = await cardService.batchImport(productId, cards, skipDuplicates);

    logger.info('Inventory batch import', {
      productId,
      productName: product.name,
      imported: result.imported,
      skipped: result.skipped,
      adminId: req.admin.id,
    });

    res.json({
      message: `成功导入 ${result.imported} 条，跳过 ${result.skipped} 条重复`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/inventory/stats — 库存统计
router.get('/inventory/stats', async (req, res, next) => {
  try {
    const stats = await prisma.inventory.groupBy({
      by: ['status'],
      _count: true,
    });

    res.json(stats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
