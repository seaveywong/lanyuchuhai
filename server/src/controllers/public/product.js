
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = Router();

const enCategoryNames = {
  facebook: 'Facebook',
  google: 'Google',
  apple: 'Apple',
  chatgpt: 'ChatGPT',
  'other-platforms': 'Other Platforms',
  'facebook-account': 'Facebook Account',
  'fb-ad-account': 'Facebook Ad Account',
  'fb-bm': 'Facebook Business Manager',
  'google-ads': 'Google Ads',
  'apple-id': 'Apple ID',
  'chatgpt-account': 'ChatGPT Account',
  other: 'Other Accounts',
};

const enProducts = {
  'Facebook 广告账户': { nameEn: 'Facebook Ad Account', descriptionEn: 'Aged advertising account with clean history and ready business verification.' },
  'Facebook BM 资源包': { nameEn: 'Facebook BM Portfolio', descriptionEn: 'Business Manager portfolio prepared for multi-market advertising operations.' },
  '跨境账号组合包': { nameEn: 'Cross-border Account Bundle', descriptionEn: 'Starter account bundle for cross-border growth teams.' },
};

function decorateCategory(category) {
  if (!category) return category;
  return {
    ...category,
    nameEn: enCategoryNames[category.slug] || category.name,
    children: Array.isArray(category.children) ? category.children.map(decorateCategory) : category.children,
    parent: category.parent ? decorateCategory(category.parent) : category.parent,
  };
}

function buildCategoryTree(categories) {
  const nodes = categories.map((category) => ({ ...category, nameEn: enCategoryNames[category.slug] || category.name, children: [] }));
  const byId = new Map(nodes.map((category) => [category.id, category]));
  const roots = [];
  for (const node of nodes) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId).children.push(node);
    else roots.push(node);
  }
  return roots;
}

function collectIds(category) {
  return [category.id, ...(category.children || []).flatMap(collectIds)];
}

async function activeCategoryTree() {
  const categories = await prisma.category.findMany({
    where: { status: 'active' },
    select: { id: true, parentId: true, name: true, slug: true, sortOrder: true, status: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  return buildCategoryTree(categories);
}

router.get('/categories', async (req, res, next) => {
  try {
    res.json(await activeCategoryTree());
  } catch (err) {
    next(err);
  }
});

router.get('/products', async (req, res, next) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);
    const where = { status: 'active' };

    if (category) {
      const tree = await activeCategoryTree();
      const flat = tree.flatMap((root) => [root, ...(root.children || [])]);
      const selected = flat.find((item) => item.slug === category);
      if (!selected) return res.json({ items: [], pagination: { page: parseInt(page, 10), limit: take, total: 0, totalPages: 0 } });
      where.categoryId = { in: collectIds(selected) };
    }
    if (req.query.search) where.name = { contains: req.query.search };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, parentId: true, name: true, slug: true, parent: { select: { id: true, name: true, slug: true } } } },
          _count: { select: { inventory: { where: { status: 'available' } } } },
        },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      items: products.map((product) => ({
        id: product.id,
        categoryId: product.categoryId,
        category: decorateCategory(product.category),
        name: product.name,
        nameEn: enProducts[product.name]?.nameEn || product.name,
        description: product.description,
        descriptionEn: enProducts[product.name]?.descriptionEn || product.description,
        price: product.price.toString(),
        currency: product.currency,
        coverImage: product.coverImage,
        hasStock: product._count.inventory > 0,
        createdAt: product.createdAt,
      })),
      pagination: { page: parseInt(page, 10), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/products/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: '无效商品 ID' });
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, parentId: true, name: true, slug: true, parent: { select: { id: true, name: true, slug: true } } } },
        _count: { select: { inventory: { where: { status: 'available' } } } },
      },
    });
    if (!product || product.status !== 'active') return res.status(404).json({ error: '商品不存在或已下架' });
    res.json({
      id: product.id,
      categoryId: product.categoryId,
      category: decorateCategory(product.category),
      name: product.name,
      nameEn: enProducts[product.name]?.nameEn || product.name,
      description: product.description,
      descriptionEn: enProducts[product.name]?.descriptionEn || product.description,
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
