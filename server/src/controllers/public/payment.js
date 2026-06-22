const { Router } = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { validateBody } = require('../../middleware/validator');
const fiatPayment = require('../../services/payment/fiat');
const logger = require('../../utils/logger');

const prisma = new PrismaClient();
const router = Router();

const methodLabels = {
  usdt_trc20: 'USDT-TRC20',
  alipay: '支付宝',
  wechat: '微信支付',
};

// GET /api/public/payment/config
router.get('/payment/config', async (req, res, next) => {
  try {
    const configs = await prisma.paymentConfig.findMany({
      where: { status: 'active' },
    });

    let exchangeRate = 7.0;
    const usdtConfig = configs.find(c => c.method === 'usdt_trc20');
    if (usdtConfig?.configJson) {
      try { const cfg = JSON.parse(usdtConfig.configJson); if (cfg.exchangeRate) exchangeRate = parseFloat(cfg.exchangeRate); }
      catch (e) { /* ignore */ }
    }

    let contact = null;
    const siteCfg = configs.find(c => c.method === 'site_settings');
    if (siteCfg?.configJson) {
      try { const cfg = JSON.parse(siteCfg.configJson); contact = { tgUsername: cfg.tgUsername || null, tgUrl: cfg.tgUrl || null }; }
      catch (e) { /* ignore */ }
    }

    res.json({
      methods: configs.filter(c => c.method !== 'site_settings').map(c => ({
        method: c.method,
        label: methodLabels[c.method] || c.method,
      })),
      exchangeRate,
      contact,
    });
  } catch (err) { next(err); }
});

// POST /api/public/payment/create — 生成支付链接
const createPaymentSchema = z.object({
  orderNo: z.string().min(8),
  method: z.enum(['alipay', 'wechat']),
});
router.post('/payment/create', validateBody(createPaymentSchema), async (req, res, next) => {
  try {
    const { orderNo, method } = req.body;
    const order = await prisma.order.findUnique({ where: { orderNo } });
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.status === 'paid') return res.status(400).json({ error: '订单已支付' });
    if (order.status === 'cancelled') return res.status(400).json({ error: '订单已取消' });

    const url = await fiatPayment.createPaymentUrl(order, method);
    res.json({ url, orderNo, method });
  } catch (err) { next(err); }
});

module.exports = router;
