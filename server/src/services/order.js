const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const config = require('../config');
const { appendLedger } = require('./wallet');
const { allocateTronWallet } = require('./tronWallet');
const { cnyToUsdtAmount, getUsdtRuntimeConfig } = require('./payment/config');

const prisma = new PrismaClient();

function generateOrderNo() {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `VT${date}${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

async function createOrder({ email, accessPin, paymentMethod, items, userId = null }) {
  const productIds = items.map((item) => item.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, status: 'active' }, include: { _count: { select: { inventory: { where: { status: 'available' } } } } } });
  if (products.length !== productIds.length) throw new AppError('商品不存在或已下架', 400);
  for (const item of items) {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (product._count.inventory < item.quantity) throw new AppError(`商品「${product.name}」库存不足，请刷新后重试`, 400);
  }
  const orderItems = items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return { product, quantity: item.quantity, unitPrice: Number(product.price) };
  });
  const totalAmount = orderItems.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
  const accessPinHash = await bcrypt.hash(accessPin, config.orderAccessPin.rounds);
  const method = paymentMethod || 'usdt_trc20';
  const usdtRuntime = method === 'usdt_trc20' ? await getUsdtRuntimeConfig() : null;
  const created = await prisma.$transaction(async (tx) => {
    const orderData = { userId, orderNo: generateOrderNo(), email: email.toLowerCase().trim(), accessPin: accessPinHash, totalAmount, currency: 'CNY', status: 'pending', paymentMethod: method };
    if (method === 'usdt_trc20') {
      const wallet = await allocateTronWallet(tx);
      orderData.tronWalletId = wallet.id;
      orderData.expectedUsdt = cnyToUsdtAmount(totalAmount, usdtRuntime.exchangeRate);
    }
    const order = await tx.order.create({ data: orderData });
    const createdItems = [];
    for (const item of orderItems) {
      const orderItem = await tx.orderItem.create({ data: { orderId: order.id, productId: item.product.id, quantity: item.quantity, unitPrice: item.unitPrice } });
      createdItems.push({ ...orderItem, product: item.product });
    }
    if (method === 'balance') {
      if (!userId) throw new AppError('余额支付需要先登录账户', 401);
      const reference = 'BALANCE_' + order.orderNo;
      await appendLedger(tx, { userId, amountCents: -Math.round(totalAmount * 100), type: 'purchase_debit', orderId: order.id, reference, note: '订单支付' });
      await fulfillOrder(tx, { ...order, items: createdItems }, 'balance', reference);
      await tx.payment.create({ data: { orderId: order.id, method: 'balance', amount: totalAmount, currency: 'CNY', tradeNo: reference, status: 'success' } });
    }
    return order;
  });
  return prisma.order.findUnique({ where: { id: created.id }, include: { items: { include: { product: { select: { name: true } } } }, tronWallet: { select: { address: true, label: true } } } });
}

async function fulfillOrder(tx, order, method, paymentRef) {
  if (!order) throw new AppError('订单不存在', 404);
  if (order.status === 'paid') return false;
  for (const item of order.items) {
    const cards = await tx.inventory.findMany({ where: { productId: item.productId, status: 'available' }, take: item.quantity, orderBy: { createdAt: 'asc' } });
    if (cards.length < item.quantity) throw new AppError(`商品「${item.product.name}」库存不足，请联系人工客服`, 409);
    const claimed = await tx.inventory.updateMany({ where: { id: { in: cards.map((card) => card.id) }, status: 'available' }, data: { status: 'sold', orderItemId: item.id, soldAt: new Date() } });
    if (claimed.count !== item.quantity) throw new AppError('库存状态已变化，请联系人工客服', 409);
  }
  await tx.order.update({ where: { id: order.id }, data: { status: 'paid', paymentMethod: method, paymentRef, paidAt: new Date() } });
  return true;
}

async function confirmPayment(orderId, method, paymentRef) {
  const confirmed = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: { include: { product: true } } } });
    return fulfillOrder(tx, order, method, paymentRef);
  });
  if (confirmed) logger.info('Payment confirmed', { orderId, method });
}

async function settleOrderPayment({ orderId, method, txHash = null, tradeNo = null, callbackRaw = null }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: { include: { product: true } } } });
    if (!order) throw new AppError('订单不存在', 404);
    if (order.status === 'paid') return order;
    if (txHash) {
      const used = await tx.payment.findUnique({ where: { txHash } });
      const topUp = await tx.walletTopUp.findUnique({ where: { txHash } });
      if (used || topUp) throw new AppError('该交易哈希已被使用', 409);
    }
    if (tradeNo) {
      const used = await tx.payment.findUnique({ where: { tradeNo } });
      const topUp = await tx.walletTopUp.findUnique({ where: { tradeNo } });
      if (used || topUp) throw new AppError('该支付流水已被使用', 409);
    }
    await tx.payment.create({ data: { orderId: order.id, method, amount: Number(order.totalAmount), currency: order.currency, txHash, tradeNo, status: 'success', callbackRaw } });
    await fulfillOrder(tx, order, method, txHash || tradeNo);
    return tx.order.findUnique({ where: { id: order.id }, include: { items: { include: { product: { select: { name: true } } } }, tronWallet: { select: { address: true, label: true } } } });
  });
}

async function payWithBalance(userId, orderId) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: { include: { product: true } } } });
    if (!order) throw new AppError('订单不存在', 404);
    if (order.userId !== userId) throw new AppError('该订单不属于当前账户', 403);
    if (order.status !== 'pending') throw new AppError('订单状态不允许余额支付', 400);
    const reference = 'BALANCE_' + order.orderNo;
    const ledger = await appendLedger(tx, { userId, amountCents: -Math.round(Number(order.totalAmount) * 100), type: 'purchase_debit', orderId: order.id, reference, note: '订单 ' + order.orderNo });
    await fulfillOrder(tx, order, 'balance', reference);
    await tx.payment.create({ data: { orderId: order.id, method: 'balance', amount: Number(order.totalAmount), currency: order.currency, tradeNo: reference, status: 'success' } });
    const paidOrder = await tx.order.findUnique({ where: { id: order.id }, include: { items: { include: { product: { select: { name: true } } } } } });
    return { order: paidOrder, balanceCents: ledger.balanceAfterCents };
  });
}

async function cancelOrder(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== 'pending') return;
  await prisma.order.update({ where: { id: orderId }, data: { status: 'cancelled' } });
  logger.info('Order cancelled', { orderId, orderNo: order.orderNo });
}

module.exports = { createOrder, confirmPayment, settleOrderPayment, cancelOrder, payWithBalance };
