const { Router } = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { adminAuth } = require('../../middleware/auth');
const { adminLimiter } = require('../../middleware/rateLimiter');
const { validateBody } = require('../../middleware/validator');
const { encrypt } = require('../../utils/crypto');
const { parsePaymentConfig } = require('../../services/payment/config');
const logger = require('../../utils/logger');

const prisma = new PrismaClient();
const router = Router();
router.use(adminAuth, adminLimiter);

const saveConfigSchema = z.object({
  method: z.enum(['usdt_trc20', 'alipay', 'wechat', 'site_settings']),
  status: z.enum(['active', 'inactive']).default('active'),
  configJson: z.record(z.any()).default({}),
});

function clean(value) {
  return String(value || '').trim();
}

function assertUrl(value, field) {
  if (value && !/^https?:\/\//i.test(value)) throw new Error(`${field} 必须以 http:// 或 https:// 开头`);
}

function sanitizeConfig(method, rawConfig, status) {
  const cfg = rawConfig || {};

  if (method === 'site_settings') {
    const tgUsername = clean(cfg.tgUsername).replace(/^@/, '');
    const tgUrl = clean(cfg.tgUrl);
    const whatsapp = clean(cfg.whatsapp);
    const email = clean(cfg.email);
    assertUrl(tgUrl, 'Telegram 链接');
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error('客服邮箱格式不正确');
    return {
      supportEnabled: cfg.supportEnabled !== false,
      supportTitle: clean(cfg.supportTitle) || '联系客服',
      supportText: clean(cfg.supportText) || '下单前后如需确认库存、支付或交付，请联系人工客服。',
      tgUsername,
      tgUrl,
      whatsapp,
      email,
      businessHours: clean(cfg.businessHours) || '工作日 10:00-22:00',
    };
  }

  if (method === 'usdt_trc20') {
    const exchangeRate = Number(cfg.exchangeRate || 7);
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw new Error('汇率必须大于 0');
    if (status === 'active' && !clean(cfg.trongridApiKey)) throw new Error('启用 USDT 前必须填写 TronGrid API Key');
    return { exchangeRate, trongridApiKey: clean(cfg.trongridApiKey) };
  }

  const gatewayUrl = clean(cfg.gatewayUrl).replace(/\/+$/, '');
  const appId = clean(cfg.appId);
  const appSecret = clean(cfg.appSecret);
  const productName = clean(cfg.productName) || '数字商品';
  const notifyUrl = clean(cfg.notifyUrl);
  const returnUrl = clean(cfg.returnUrl);
  assertUrl(gatewayUrl, '网关地址');
  assertUrl(notifyUrl, '异步回调地址');
  assertUrl(returnUrl, '同步返回地址');
  if (status === 'active' && (!gatewayUrl || !appId || !appSecret)) throw new Error('启用支付宝/微信前必须填写网关地址、商户号和密钥');
  return { gatewayType: 'epay', gatewayUrl, appId, appSecret, productName, notifyUrl, returnUrl };
}

router.get('/payment-configs', async (req, res, next) => {
  try {
    const configs = await prisma.paymentConfig.findMany({ orderBy: { method: 'asc' } });
    res.json(configs.map((c) => ({ id: c.id, method: c.method, status: c.status, config: parsePaymentConfig(c.configJson), hasConfig: !!c.configJson, updatedAt: c.updatedAt })));
  } catch (err) {
    next(err);
  }
});

router.post('/payment-configs', validateBody(saveConfigSchema), async (req, res, next) => {
  try {
    const { method, status } = req.body;
    const safeConfig = sanitizeConfig(method, req.body.configJson, status);
    const encryptedConfig = encrypt(JSON.stringify(safeConfig));
    const config = await prisma.paymentConfig.upsert({
      where: { method },
      create: { method, configJson: encryptedConfig, status },
      update: { configJson: encryptedConfig, status },
    });
    logger.info('Payment config updated', { method, status, adminId: req.admin.id });
    res.json({ id: config.id, method: config.method, status: config.status });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
