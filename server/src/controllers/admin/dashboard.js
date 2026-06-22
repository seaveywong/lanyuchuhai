/**
 * 管理接口 — 数据看板
 */
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { adminAuth } = require('../../middleware/auth');
const { adminLimiter } = require('../../middleware/rateLimiter');

const prisma = new PrismaClient();
const router = Router();
router.use(adminAuth, adminLimiter);

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalProducts,
      totalInventory,
      availableInventory,
      totalOrders,
      paidOrders,
      todayOrders,
      todayRevenue,
      totalRevenue,
    ] = await Promise.all([
      prisma.product.count({ where: { status: 'active' } }),
      prisma.inventory.count(),
      prisma.inventory.count({ where: { status: 'available' } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'paid' } }),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: today }, status: 'paid' },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { status: 'paid' },
        _sum: { totalAmount: true },
      }),
    ]);

    res.json({
      products: { total: totalProducts },
      inventory: { total: totalInventory, available: availableInventory },
      orders: { total: totalOrders, paid: paidOrders, today: todayOrders },
      revenue: {
        today: todayRevenue._sum.totalAmount || 0,
        total: totalRevenue._sum.totalAmount || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
