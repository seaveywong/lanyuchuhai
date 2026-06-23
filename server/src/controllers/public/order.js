const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { validateBody } = require('../../middleware/validator');
const { orderLimiter, lookupLimiter } = require('../../middleware/rateLimiter');
const { optionalCustomerAuth } = require('../../middleware/auth');
const orderService = require('../../services/order');
const cardService = require('../../services/card');
const { sendOrderEmail } = require('../../services/email');
const logger = require('../../utils/logger');

const prisma = new PrismaClient();
const router = Router();
const orderNoSchema = z.object({ orderNo: z.string().regex(/^(VT\d{6}[A-F0-9]{10}|FB\d{6}[A-Z0-9]{6})$/, '订单号格式不正确') });
const createOrderSchema = z.object({
  email: z.string().email('请输入有效邮箱地址').transform((value) => value.toLowerCase().trim()),
  accessPin: z.string().regex(/^\d{6}$/, '请设置 6 位数字查询密码'),
  paymentMethod: z.enum(['usdt_trc20', 'alipay', 'wechat', 'balance']).default('usdt_trc20'),
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(100).default(1) })).min(1).max(20),
});

router.post('/orders', optionalCustomerAuth, orderLimiter, validateBody(createOrderSchema), async (req, res, next) => {
  try {
    const { email, accessPin, paymentMethod, items } = req.body;
    if (paymentMethod === 'balance' && !req.user) return res.status(401).json({ error: '余额支付需要先登录账户' });
    const order = await orderService.createOrder({ email: paymentMethod === 'balance' ? req.user.email : email, accessPin, paymentMethod, items, userId: req.user?.id || null });
    const balanceCents = paymentMethod === 'balance' ? (await prisma.user.findUnique({ where: { id: req.user.id }, select: { balanceCents: true } })).balanceCents : null;
    logger.info('Order created', { orderNo: order.orderNo, email: order.email });
    void sendOrderEmail(order.email, order.orderNo, order.status === 'paid').catch(() => undefined);
    res.status(201).json({
      orderNo: order.orderNo, email: order.email, totalAmount: order.totalAmount.toString(), currency: order.currency, status: order.status,
      paymentMethod: order.paymentMethod, expectedUsdt: order.expectedUsdt, tronWallet: order.tronWallet,
      items: order.items.map((item) => ({ productId: item.productId, productName: item.product.name, quantity: item.quantity, unitPrice: item.unitPrice.toString() })),
      createdAt: order.createdAt, balanceCents, message: order.status === 'paid' ? '订单已支付并自动交付' : '下单成功，请尽快完成支付',
    });
  } catch (err) { next(err); }
});

router.get('/orders/:orderNo', lookupLimiter, async (req, res, next) => {
  try {
    const parsed = orderNoSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: '订单号格式不正确' });
    const order = await prisma.order.findUnique({
      where: { orderNo: parsed.data.orderNo },
      select: { orderNo: true, status: true, totalAmount: true, currency: true, paymentMethod: true, expectedUsdt: true, paidAt: true, createdAt: true, tronWallet: { select: { address: true, label: true } } },
    });
    if (!order) return res.status(404).json({ error: '订单不存在' });
    res.json(order);
  } catch (err) { next(err); }
});

const lookupSchema = z.object({ email: z.string().email().transform((value) => value.toLowerCase().trim()), accessPin: z.string().regex(/^\d{6}$/) });
router.post('/orders/lookup', lookupLimiter, validateBody(lookupSchema), async (req, res, next) => {
  try {
    const { email, accessPin } = req.body;
    const recentOrders = await prisma.order.findMany({ where: { email }, orderBy: { createdAt: 'desc' }, take: 20, include: { items: { include: { product: { select: { name: true } } } }, payments: true } });
    let order = null;
    for (const candidate of recentOrders) {
      const matched = candidate.accessPin.startsWith('$2') ? await bcrypt.compare(accessPin, candidate.accessPin) : candidate.accessPin === accessPin;
      if (matched) { order = candidate; break; }
    }
    if (!order) return res.status(404).json({ error: '未找到匹配的订单，请检查邮箱和查询密码' });
    const cards = order.status === 'paid' ? await cardService.getCardsByOrder(order.id) : null;
    res.json({ orderNo: order.orderNo, email: order.email, status: order.status, totalAmount: order.totalAmount.toString(), currency: order.currency, paymentMethod: order.paymentMethod, paidAt: order.paidAt, createdAt: order.createdAt, items: order.items.map((item) => ({ productName: item.product.name, quantity: item.quantity, unitPrice: item.unitPrice.toString() })), cards });
  } catch (err) { next(err); }
});
module.exports = router;
