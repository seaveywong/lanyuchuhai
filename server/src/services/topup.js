const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middleware/errorHandler');
const { appendLedger, toCents } = require('./wallet');
const { allocateTronWallet } = require('./tronWallet');
const { cnyToUsdtAmount, getUsdtRuntimeConfig } = require('./payment/config');

const prisma = new PrismaClient();
function generateTopUpNo() {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return 'TP' + date + crypto.randomBytes(5).toString('hex').toUpperCase();
}

async function createTopUp({ userId, amount, paymentMethod }) {
  const amountCents = toCents(amount);
  if (amountCents < 100) throw new AppError('单次充值金额不能低于 1 元', 400);
  const runtime = paymentMethod === 'usdt_trc20' ? await getUsdtRuntimeConfig() : null;
  if (paymentMethod === 'usdt_trc20' && !runtime.trongridApiKey) throw new AppError('USDT 链上核验尚未配置', 503);
  return prisma.$transaction(async (tx) => {
    const data = { topUpNo: generateTopUpNo(), userId, amountCents, paymentMethod, expectedUsdt: paymentMethod === 'usdt_trc20' ? cnyToUsdtAmount(amount, runtime.exchangeRate) : null };
    if (paymentMethod === 'usdt_trc20') data.tronWalletId = (await allocateTronWallet(tx)).id;
    return tx.walletTopUp.create({ data, include: { tronWallet: { select: { address: true, label: true } } } });
  });
}

async function settleTopUp({ topUpId, method, txHash = null, tradeNo = null, callbackRaw = null }) {
  return prisma.$transaction(async (tx) => {
    const topUp = await tx.walletTopUp.findUnique({ where: { id: topUpId } });
    if (!topUp) throw new AppError('充值单不存在', 404);
    if (topUp.status === 'paid') return topUp;
    if (txHash) {
      const orderPayment = await tx.payment.findUnique({ where: { txHash } });
      const otherTopUp = await tx.walletTopUp.findUnique({ where: { txHash } });
      if (orderPayment || (otherTopUp && otherTopUp.id !== topUp.id)) throw new AppError('该交易哈希已被使用', 409);
    }
    if (tradeNo) {
      const orderPayment = await tx.payment.findUnique({ where: { tradeNo } });
      const otherTopUp = await tx.walletTopUp.findUnique({ where: { tradeNo } });
      if (orderPayment || (otherTopUp && otherTopUp.id !== topUp.id)) throw new AppError('该支付流水已被使用', 409);
    }
    const ledger = await appendLedger(tx, { userId: topUp.userId, amountCents: topUp.amountCents, type: 'payment_credit', reference: 'TOPUP_' + topUp.topUpNo, note: '余额充值' });
    const result = await tx.walletTopUp.update({ where: { id: topUp.id }, data: { status: 'paid', paymentMethod: method, txHash, tradeNo, callbackRaw, paidAt: new Date() }, include: { tronWallet: { select: { address: true, label: true } } } });
    return { ...result, balanceCents: ledger.balanceAfterCents };
  });
}

module.exports = { createTopUp, settleTopUp };
