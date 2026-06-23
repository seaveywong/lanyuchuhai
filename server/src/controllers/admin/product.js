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

function slugify(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildCategoryTree(categories) {
  const nodes = categories.map((c) => ({ ...c, children: [] }));
  const byId = new Map(nodes.map((c) => [c.id, c]));
  const roots = [];
  for (const node of nodes) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId).children.push(node);
    else roots.push(node);
  }
  return roots;
}

async function ensureLeafCategory(categoryId) {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, include: { children: true } });
  if (!category) throw new Error('分类不存在');
  if (category.children.length > 0) throw new Error('请选择小类，不能直接挂到大类');
  return category;
}

router.get('/products', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, categoryId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100);
    const where = {};
    if (status) where.status = status;
    if (categoryId) where.categoryId = parseInt(categoryId);
    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, include: { category: { include: { parent: true } }, _count: { select: { inventory: true } } }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], skip, take }),
      prisma.product.count({ where }),
    ]);
    res.json({ items: products, pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) } });
  } catch (err) { next(err); }
});

const productSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  price: z.number().positive(),
  currency: z.string().default('CNY'),
  categoryId: z.number().int().positive(),
  coverImage: z.string().url().optional().or(z.literal('')).nullable(),
  sortOrder: z.number().int().default(0),
  status: z.string().default('active'),
  stockVisible: z.boolean().default(true),
});

router.post('/products', validateBody(productSchema), async (req, res, next) => {
  try {
    await ensureLeafCategory(req.body.categoryId);
    const product = await prisma.product.create({ data: req.body });
    logger.info('Product created', { id: product.id, name: product.name, adminId: req.admin.id });
    res.status(201).json(product);
  } catch (err) { next(err); }
});

router.put('/products/:id', validateBody(productSchema.partial()), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (req.body.categoryId) await ensureLeafCategory(req.body.categoryId);
    const product = await prisma.product.update({ where: { id }, data: req.body });
    logger.info('Product updated', { id, name: product.name, adminId: req.admin.id });
    res.json(product);
  } catch (err) { next(err); }
});

router.delete('/products/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const hasInventory = await prisma.inventory.count({ where: { productId: id } });
    if (hasInventory > 0) return res.status(400).json({ error: '该商品下还有库存，请先清空库存' });
    await prisma.product.delete({ where: { id } });
    logger.info('Product deleted', { id, adminId: req.admin.id });
    res.json({ success: true });
  } catch (err) { next(err); }
});

const categorySchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(100).optional(),
  parentId: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().default(0),
  status: z.enum(['active', 'inactive']).default('active'),
});

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], include: { parent: true, children: true, _count: { select: { products: true } } } });
    res.json(req.query.tree === '1' ? buildCategoryTree(categories) : categories);
  } catch (err) { next(err); }
});

router.post('/categories', validateBody(categorySchema), async (req, res, next) => {
  try {
    const data = { ...req.body, slug: req.body.slug || slugify(req.body.name), parentId: req.body.parentId || null };
    if (data.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
      if (!parent) return res.status(400).json({ error: '父分类不存在' });
      if (parent.parentId) return res.status(400).json({ error: '当前仅支持两级分类' });
    }
    const category = await prisma.category.create({ data });
    logger.info('Category created', { id: category.id, name: category.name, adminId: req.admin.id });
    res.status(201).json(category);
  } catch (err) { next(err); }
});

router.put('/categories/:id', validateBody(categorySchema.partial()), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const data = { ...req.body };
    if (data.name && !data.slug) data.slug = slugify(data.name);
    if ('parentId' in data) data.parentId = data.parentId || null;
    if (data.parentId) {
      if (data.parentId === id) return res.status(400).json({ error: '不能把自己设为父分类' });
      const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
      if (!parent) return res.status(400).json({ error: '父分类不存在' });
      if (parent.parentId) return res.status(400).json({ error: '当前仅支持两级分类' });
    }
    const category = await prisma.category.update({ where: { id }, data });
    logger.info('Category updated', { id, name: category.name, adminId: req.admin.id });
    res.json(category);
  } catch (err) { next(err); }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const [children, products] = await Promise.all([prisma.category.count({ where: { parentId: id } }), prisma.product.count({ where: { categoryId: id } })]);
    if (children > 0) return res.status(400).json({ error: '该大类下还有小类，不能删除' });
    if (products > 0) return res.status(400).json({ error: '该分类下还有商品，不能删除' });
    await prisma.category.delete({ where: { id } });
    logger.info('Category deleted', { id, adminId: req.admin.id });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
