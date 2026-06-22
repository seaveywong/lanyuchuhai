/**
 * USDT-TRC20 支付服务
 * - 为每个订单生成独立收款地址（或使用统一地址+备注）
 * - Cron Job 轮询链上交易确认
 */
const config = require('../../config');
const { getTrc20Transactions, parseUsdtAmount } = require('../../utils/tron');
const logger = require('../../utils/logger');

/**
 * 获取商户收款地址
 * 生产环境可使用 HD 钱包为每个订单派生独立地址
 * 简化版使用统一地址，通过金额区分订单
 */
function getMerchantAddress() {
  if (!config.usdt.merchantAddress) {
    throw new Error('MERCHANT_WALLET_ADDRESS not configured');
  }
  return config.usdt.merchantAddress;
}

/**
 * 查询某地址的 USDT 交易记录
 * @param {string} address
 * @param {number} sinceTimestamp - 从何时开始查询 (毫秒)
 * @returns {Promise<Array<{txHash: string, from: string, to: string, amount: number, timestamp: number}>>}
 */
async function getTransactions(address, sinceTimestamp = 0) {
  const rawTxs = await getTrc20Transactions(address, {
    minTimestamp: sinceTimestamp,
    limit: 50,
  });

  return rawTxs
    .filter((tx) => tx.to?.toLowerCase() === address.toLowerCase())
    .map((tx) => ({
      txHash: tx.transaction_id,
      from: tx.from,
      to: tx.to,
      amount: parseUsdtAmount(tx.value),
      timestamp: tx.block_timestamp,
    }))
    .filter((tx) => tx.amount > 0);
}

/**
 * 检查是否有新的支付到账 (由 Cron Job 调用)
 * 匹配逻辑: 查找所有 pending 订单，对比链上金额
 */
async function checkNewPayments() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const orderService = require('../order');

  try {
    const merchantAddress = getMerchantAddress();
    const pendingOrders = await prisma.order.findMany({
      where: {
        status: 'pending',
        paymentMethod: 'usdt_trc20',
      },
      orderBy: { createdAt: 'asc' },
    });

    if (pendingOrders.length === 0) return;

    // 查询最近交易
    const lookbackMs = config.usdt.paymentLookbackMinutes * 60 * 1000;
    const since = Date.now() - lookbackMs;
    const transactions = await getTransactions(merchantAddress, since);

    for (const order of pendingOrders) {
      const orderAmount = parseFloat(order.totalAmount);

      // 匹配: 同金额 USDT 交易（生产中应使用备注/派生地址更精确）
      const matched = transactions.find((tx) => {
        // 查找未处理的交易
        return Math.abs(tx.amount - orderAmount) < 0.01; // 容差 0.01 USDT，生产建议改为独立地址或唯一金额
      });

      if (matched) {
        // 检查该 txHash 是否已被其他订单使用
        const existingPayment = await prisma.payment.findFirst({
          where: { txHash: matched.txHash },
        });

        if (existingPayment) continue; // 已处理

        logger.info('USDT payment detected', {
          orderNo: order.orderNo,
          txHash: matched.txHash,
          amount: matched.amount,
        });

        // 记录支付
        await prisma.payment.create({
          data: {
            orderId: order.id,
            method: 'usdt_trc20',
            amount: matched.amount,
            currency: 'USDT',
            txHash: matched.txHash,
            status: 'success',
          },
        });

        // 确认支付 → 自动发卡
        await orderService.confirmPayment(order.id, 'usdt_trc20', matched.txHash);
      }
    }
  } catch (err) {
    logger.error('USDT payment check failed', { error: err.message });
  }
}

module.exports = { getMerchantAddress, checkNewPayments };
