/**
 * 数据清理定时任务
 * - 每天凌晨3点执行
 * - 待支付订单: 24小时后自动取消
 * - 已售卡密: 30天后自动删除
 */
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

async function cleanup() {
  const now = new Date();

  // 1. 取消24小时未支付的订单
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const cancelled = await prisma.order.updateMany({
    where: {
      status: 'pending',
      createdAt: { lt: oneDayAgo },
    },
    data: { status: 'cancelled' },
  });
  if (cancelled.count > 0) {
    logger.info(`Auto-cancelled ${cancelled.count} stale pending orders`);
  }

  // 2. 删除30天前已售出的卡密
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const deleted = await prisma.inventory.deleteMany({
    where: {
      status: 'sold',
      soldAt: { lt: thirtyDaysAgo },
    },
  });
  if (deleted.count > 0) {
    logger.info(`Deleted ${deleted.count} sold cards older than 30 days`);
  }
}

cron.schedule('0 3 * * *', async () => {
  try { await cleanup(); } catch (err) {
    logger.error('Cleanup job error', { error: err.message });
  }
});

logger.info('Cleanup job scheduled (daily 3:00 AM, 24h cancel / 30d delete)');

// 启动后30秒执行一次
setTimeout(cleanup, 30000);
