/**
 * USDT-TRC20 链上监听定时任务
 * 每 30 秒轮询一次，检测未支付订单是否有新的链上交易
 */
const cron = require('node-cron');
const config = require('../config');
const logger = require('../utils/logger');

let isRunning = false;

// 检查是否配置了 USDT
if (!config.usdt.merchantAddress || !config.usdt.trongridApiKey) {
  logger.warn('USDT monitor not started: missing TRONGRID_API_KEY or MERCHANT_WALLET_ADDRESS');
} else {
  // 每 30 秒执行一次
  cron.schedule('*/30 * * * * *', async () => {
    if (isRunning) {
      logger.debug('USDT monitor skipped (previous run still active)');
      return;
    }

    isRunning = true;
    try {
      const { checkNewPayments } = require('../services/payment/usdt');
      await checkNewPayments();
    } catch (err) {
      logger.error('USDT monitor error', { error: err.message });
    } finally {
      isRunning = false;
    }
  });

  logger.info('USDT monitor scheduled (every 30s)');
}
