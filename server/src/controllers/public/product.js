/**
 * 公开接口 — 商品
 */
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = Router();

// GET /api/public/products — 商品列表
router.get('/products', async (req, res, next) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100);

    const where = { status: 'active' };
    if (category) {
      where.category = { slug: category, status: 'active' };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { inventory: { where: { status: 'available' } } } },
        },
        where: {
          ...where,
          ...(req.query.search ? {
            name: { contains: req.query.search },
          } : {}),
        },
        orderBy: { sortOrder: 'asc' },
        skip,
        take,
      }),
      prisma.product.count({ where }),
    ]);

    // 前端看不到库存数量，只看到"有货/无货"
    const items = products.map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      category: p.category,
      name: p.name,
      description: p.description,
      price: p.price.toString(),
      currency: p.currency,
      coverImage: p.coverImage,
      hasStock: p._count.inventory > 0,
      createdAt: p.createdAt,
    }));

    res.json({
      items,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/public/products/:id — 商品详情
router.get('/products/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: '无效的商品ID' });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { inventory: { where: { status: 'available' } } } },
      },
    });

    if (!product || product.status !== 'active') {
      return res.status(404).json({ error: '商品不存在或已下架' });
    }

    res.json({
      id: product.id,
      categoryId: product.categoryId,
      category: product.category,
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      currency: product.currency,
      coverImage: product.coverImage,
      hasStock: product._count.inventory > 0,
      createdAt: product.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
