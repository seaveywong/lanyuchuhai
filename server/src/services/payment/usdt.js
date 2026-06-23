const config = require('../../config');
const { getTrc20Transactions, parseUsdtAmount } = require('../../utils/tron');
const logger = require('../../utils/logger');
const { getUsdtRuntimeConfig, cnyToUsdtAmount } = require('./config');

async function getMerchantAddress() {
  const runtimeConfig = await getUsdtRuntimeConfig();
  if (!runtimeConfig.merchantAddress) throw new Error('MERCHANT_WALLET_ADDRESS not configured');
  return runtimeConfig.merchantAddress;
}

async function getTransactions(address, sinceTimestamp = 0) {
  const rawTxs = await getTrc20Transactions(address, { minTimestamp: sinceTimestamp, limit: 50 });
  return rawTxs
    .filter((tx) => tx.to?.toLowerCase() === address.toLowerCase())
    .map((tx) => ({ txHash: tx.transaction_id, from: tx.from, to: tx.to, amount: parseUsdtAmount(tx.value), timestamp: tx.block_timestamp }))
    .filter((tx) => tx.amount > 0);
}

async function checkNewPayments() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const orderService = require('../order');
  try {
    const runtimeConfig = await getUsdtRuntimeConfig();
    if (!runtimeConfig.merchantAddress) {
      logger.warn('USDT payment check skipped: merchant address not configured');
      return;
    }
    const pendingOrders = await prisma.order.findMany({ where: { status: 'pending', paymentMethod: 'usdt_trc20' }, orderBy: { createdAt: 'asc' } });
    if (pendingOrders.length === 0) return;
    const since = Date.now() - config.usdt.paymentLookbackMinutes * 60 * 1000;
    const transactions = await getTransactions(runtimeConfig.merchantAddress, since);
    for (const order of pendingOrders) {
      const expectedUsdt = cnyToUsdtAmount(order.totalAmount, runtimeConfig.exchangeRate);
      const matched = transactions.find((tx) => Math.abs(tx.amount - expectedUsdt) < 0.01);
      if (!matched) continue;
      const existingPayment = await prisma.payment.findFirst({ where: { txHash: matched.txHash } });
      if (existingPayment) continue;
      logger.info('USDT payment detected', { orderNo: order.orderNo, txHash: matched.txHash, amount: matched.amount, expectedUsdt });
      await prisma.payment.create({ data: { orderId: order.id, method: 'usdt_trc20', amount: matched.amount, currency: 'USDT', txHash: matched.txHash, status: 'success' } });
      await orderService.confirmPayment(order.id, 'usdt_trc20', matched.txHash);
    }
  } catch (err) {
    logger.error('USDT payment check failed', { error: err.message });
  }
}

module.exports = { getMerchantAddress, checkNewPayments };
