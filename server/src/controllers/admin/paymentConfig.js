/**
 * 管理接口 — 支付配置
 */
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { adminAuth } = require('../../middleware/auth');
const { adminLimiter } = require('../../middleware/rateLimiter');
const logger = require('../../utils/logger');

const prisma = new PrismaClient();
const router = Router();
router.use(adminAuth, adminLimiter);

// GET /api/admin/payment-configs — 获取全部配置（含解密后的详情）
router.get('/payment-configs', async (req, res, next) => {
  try {
    const configs = await prisma.paymentConfig.findMany();

    const safe = configs.map((c) => {
      let configDetail = null;
      if (c.configJson) {
        try {
          const { decrypt } = require('../../utils/crypto');
          configDetail = JSON.parse(decrypt(c.configJson));
        } catch (e) {
          configDetail = { error: '解密失败' };
        }
      }
      return {
        id: c.id,
        method: c.method,
        status: c.status,
        config: configDetail,
        hasConfig: !!c.configJson,
        updatedAt: c.updatedAt,
      };
    });

    res.json(safe);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/payment-configs — 保存配置
router.post('/payment-configs', async (req, res, next) => {
  try {
    const { method, configJson, status } = req.body;

    const { encrypt } = require('../../utils/crypto');
    const encryptedConfig = encrypt(JSON.stringify(configJson));

    const config = await prisma.paymentConfig.upsert({
      where: { method },
      create: { method, configJson: encryptedConfig, status: status || 'active' },
      update: { configJson: encryptedConfig, status: status || 'active' },
    });

    logger.info('Payment config updated', { method, adminId: req.admin.id });
    res.json({ id: config.id, method: config.method, status: config.status });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
