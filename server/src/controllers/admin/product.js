/**
 * 管理接口 — 商品 CRUD
 */
const { Router } = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { adminAuth } = require('../../middleware/auth');
const { validateBody } = require('../../middleware/validator');
const { adminLimiter } = require('../../middleware/rateLimiter');
const logger = require('../../utils/logger');

const prisma = new PrismaClient();
const router = Router();
router.use(adminAuth, adminLimiter);

// GET /api/admin/products
router.get('/products', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, categoryId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100);

    const where = {};
    if (status) where.status = status;
    if (categoryId) where.categoryId = parseInt(categoryId);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          _count: { select: { inventory: true } },
        },
        orderBy: { sortOrder: 'asc' },
        skip,
        take,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      items: products,
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/products
const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  price: z.number().positive(),
  currency: z.string().default('CNY'),
  categoryId: z.number().int().positive(),
  coverImage: z.string().url().optional().or(z.literal('')),
  sortOrder: z.number().int().default(0),
  status: z.string().default('active'),
  stockVisible: z.boolean().default(true),
});

router.post('/products', validateBody(createProductSchema), async (req, res, next) => {
  try {
    const product = await prisma.product.create({ data: req.body });
    logger.info('Product created', { id: product.id, name: product.name, adminId: req.admin.id });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/products/:id
router.put('/products/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const product = await prisma.product.update({ where: { id }, data: req.body });
    logger.info('Product updated', { id, name: product.name, adminId: req.admin.id });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const hasInventory = await prisma.inventory.count({ where: { productId: id } });
    if (hasInventory > 0) {
      return res.status(400).json({ error: '该商品下还有库存，请先清空库存' });
    }
    await prisma.product.delete({ where: { id } });
    logger.info('Product deleted', { id, adminId: req.admin.id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ========== 商品分类 ==========

// GET /api/admin/categories
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/categories
router.post('/categories', async (req, res, next) => {
  try {
    const category = await prisma.category.create({ data: req.body });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
