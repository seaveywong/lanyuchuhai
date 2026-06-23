const { Router } = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { validateBody } = require('../../middleware/validator');
const fiatPayment = require('../../services/payment/fiat');
const { getPublicPaymentConfig } = require('../../services/payment/config');
const prisma = new PrismaClient();
const router = Router();

router.get('/payment/config', async (req, res, next) => {
  try { res.json(await getPublicPaymentConfig()); }
  catch (err) { next(err); }
});

const createPaymentSchema = z.object({ orderNo: z.string().min(8), method: z.enum(['alipay', 'wechat']) });
router.post('/payment/create', validateBody(createPaymentSchema), async (req, res, next) => {
  try {
    const { orderNo, method } = req.body;
    const publicConfig = await getPublicPaymentConfig();
    if (!publicConfig.methods.some((item) => item.method === method)) return res.status(400).json({ error: '该支付方式暂未启用' });
    const order = await prisma.order.findUnique({ where: { orderNo } });
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.status === 'paid') return res.status(400).json({ error: '订单已支付' });
    if (order.status === 'cancelled') return res.status(400).json({ error: '订单已取消' });
    const url = await fiatPayment.createPaymentUrl(order, method);
    res.json({ url, orderNo, method });
  } catch (err) { next(err); }
});

module.exports = router;
