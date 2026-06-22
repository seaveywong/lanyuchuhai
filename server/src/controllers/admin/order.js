/**
 * 管理接口 — 订单管理
 */
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { adminAuth } = require('../../middleware/auth');
const { adminLimiter } = require('../../middleware/rateLimiter');
const cardService = require('../../services/card');
const orderService = require('../../services/order');
const logger = require('../../utils/logger');

const prisma = new PrismaClient();
const router = Router();
router.use(adminAuth, adminLimiter);

// GET /api/admin/orders — 订单列表
router.get('/orders', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, email, orderNo } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100);

    const where = {};
    if (status) where.status = status;
    if (email) where.email = { contains: email };
    if (orderNo) where.orderNo = { contains: orderNo };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: { product: { select: { name: true } } },
          },
          payments: { select: { method: true, txHash: true, tradeNo: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      items: orders,
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/orders/:id — 订单详情（含解密后的卡密）
router.get('/orders/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
            inventory: true,
          },
        },
        payments: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }

    // 管理员可以查看卡密内容（已支付订单）
    let cards = null;
    if (order.status === 'paid') {
      cards = await cardService.getCardsByOrder(order.id);
    }

    res.json({ order, cards });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/orders/:id/status — 手动更新订单状态
router.put('/orders/:id/status', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    const order = await prisma.order.update({ where: { id }, data: { status } });
    logger.info('Order status updated', { orderId: id, status, adminId: req.admin.id });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/orders/:id/cancel — 取消订单（释放库存）
router.post('/orders/:id/cancel', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await orderService.cancelOrder(id);
    logger.info('Order cancelled by admin', { orderId: id, adminId: req.admin.id });
    res.json({ success: true, message: '订单已取消，库存已释放' });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/orders/:id/confirm-payment — 手动确认支付（模拟支付成功）
router.post('/orders/:id/confirm-payment', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const order = await prisma.order.findUnique({ where: { id } });

    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.status === 'paid') return res.json({ success: true, message: '订单已支付，无需重复确认' });
    if (order.status === 'cancelled') return res.status(400).json({ error: '已取消的订单无法确认支付' });

    // 创建模拟支付记录
    await prisma.payment.create({
      data: {
        orderId: id,
        method: order.paymentMethod || 'manual',
        amount: order.totalAmount,
        currency: order.currency,
        tradeNo: 'MANUAL_' + Date.now(),
        status: 'success',
      },
    });

    // 确认支付 → 自动发卡
    await orderService.confirmPayment(id, order.paymentMethod || 'manual', 'MANUAL_' + Date.now());

    logger.info('Payment manually confirmed by admin', { orderId: id, orderNo: order.orderNo, adminId: req.admin.id });
    res.json({ success: true, message: '✅ 支付已确认，库存已扣减，卡密已可查看' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
