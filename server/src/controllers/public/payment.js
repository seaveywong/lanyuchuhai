const { Router } = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { validateBody } = require('../../middleware/validator');
const { lookupLimiter } = require('../../middleware/rateLimiter');
const fiatPayment = require('../../services/payment/fiat');
const { getPublicPaymentConfig, getUsdtRuntimeConfig } = require('../../services/payment/config');
const { customerAuth } = require('../../middleware/auth');
const { createTopUp, settleTopUp } = require('../../services/topup');
const { findUsdtTransfer, verifyUsdtTransfer } = require('../../utils/tron');
const orderService = require('../../services/order');
const { AppError } = require('../../middleware/errorHandler');

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

async function ensureTxUnused(txHash) {
  const [payment, topUp] = await Promise.all([
    prisma.payment.findUnique({ where: { txHash } }),
    prisma.walletTopUp.findUnique({ where: { txHash } }),
  ]);
  if (payment || topUp) throw new AppError('该链上交易已被其他订单或充值单使用', 409);
}

async function autoSettleUsdtOrder(order) {
  if (!order.tronWallet || !order.expectedUsdt) throw new AppError('订单缺少收款地址，请联系客服', 400);
  const runtime = await getUsdtRuntimeConfig();
  if (!runtime.trongridApiKey) throw new AppError('USDT 链上检测尚未配置', 503);
  const transfer = await findUsdtTransfer({
    toAddress: order.tronWallet.address,
    expectedAmount: order.expectedUsdt,
    apiKey: runtime.trongridApiKey,
    minTimestamp: order.createdAt.getTime() - 10 * 60 * 1000,
  });
  if (!transfer) return null;
  await ensureTxUnused(transfer.transaction_id);
  return orderService.settleOrderPayment({ orderId: order.id, method: 'usdt_trc20', txHash: transfer.transaction_id });
}

const checkPaymentSchema = z.object({ orderNo: z.string().min(8) });
router.post('/payment/check', lookupLimiter, validateBody(checkPaymentSchema), async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { orderNo: req.body.orderNo }, include: { tronWallet: true } });
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.status !== 'pending') return res.json({ orderNo: order.orderNo, status: order.status, paidAt: order.paidAt, message: order.status === 'paid' ? '订单已支付' : '订单当前不可支付' });
    if (order.paymentMethod !== 'usdt_trc20') return res.json({ orderNo: order.orderNo, status: order.status, message: '等待支付通道回调确认，请稍后刷新' });
    const paid = await autoSettleUsdtOrder(order);
    if (!paid) return res.json({ orderNo: order.orderNo, status: 'pending', message: '暂未检测到匹配的 USDT-TRC20 入账，请确认网络、金额和收款地址后稍后再试' });
    res.json({ orderNo: paid.orderNo, status: paid.status, paidAt: paid.paidAt, message: '已检测到链上入账，订单已自动交付' });
  } catch (err) { next(err); }
});

const txSchema = z.object({ orderNo: z.string().min(8), email: z.string().email().transform((value) => value.toLowerCase().trim()), accessPin: z.string().regex(/^\d{6}$/), txHash: z.string().trim().min(40).max(128) });
router.post('/payment/usdt/submit-tx', validateBody(txSchema), async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { orderNo: req.body.orderNo }, include: { tronWallet: true } });
    if (!order || order.paymentMethod !== 'usdt_trc20' || order.status !== 'pending') return res.status(404).json({ error: '未找到待支付的 USDT 订单' });
    if (order.email !== req.body.email || !(await bcrypt.compare(req.body.accessPin, order.accessPin))) return res.status(403).json({ error: '邮箱或查询密码不正确' });
    if (!order.tronWallet || !order.expectedUsdt) return res.status(400).json({ error: '订单缺少收款地址，请联系客服' });
    const runtime = await getUsdtRuntimeConfig();
    if (!runtime.trongridApiKey) return res.status(503).json({ error: 'USDT 链上检测尚未配置' });
    await verifyUsdtTransfer({ txHash: req.body.txHash, toAddress: order.tronWallet.address, expectedAmount: order.expectedUsdt, apiKey: runtime.trongridApiKey, minTimestamp: order.createdAt.getTime() - 10 * 60 * 1000 });
    await ensureTxUnused(req.body.txHash);
    const paid = await orderService.settleOrderPayment({ orderId: order.id, method: 'usdt_trc20', txHash: req.body.txHash });
    res.json({ orderNo: paid.orderNo, status: paid.status, paidAt: paid.paidAt });
  } catch (err) { next(err); }
});

const topUpSchema = z.object({ amount: z.number().positive().max(100000), method: z.enum(['usdt_trc20', 'alipay', 'wechat']) });
router.post('/topups', customerAuth, validateBody(topUpSchema), async (req, res, next) => {
  try {
    const config = await getPublicPaymentConfig();
    if (!config.methods.some((item) => item.method === req.body.method)) return res.status(400).json({ error: '该充值方式暂未启用' });
    const topUp = await createTopUp({ userId: req.user.id, amount: req.body.amount, paymentMethod: req.body.method });
    const result = { topUpNo: topUp.topUpNo, amountCents: topUp.amountCents, expectedUsdt: topUp.expectedUsdt, paymentMethod: topUp.paymentMethod, status: topUp.status, tronWallet: topUp.tronWallet };
    if (req.body.method === 'alipay' || req.body.method === 'wechat') result.url = await fiatPayment.createPaymentUrl({ orderNo: topUp.topUpNo, totalAmount: topUp.amountCents / 100, returnPath: '/account' }, req.body.method);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

router.get('/topups/:topUpNo', customerAuth, async (req, res, next) => {
  try {
    const topUp = await prisma.walletTopUp.findFirst({ where: { topUpNo: req.params.topUpNo, userId: req.user.id }, include: { tronWallet: { select: { address: true, label: true } } } });
    if (!topUp) return res.status(404).json({ error: '充值单不存在' });
    res.json(topUp);
  } catch (err) { next(err); }
});

async function autoSettleUsdtTopUp(topUp) {
  if (!topUp.tronWallet || !topUp.expectedUsdt) throw new AppError('充值单缺少收款地址，请联系客服', 400);
  const runtime = await getUsdtRuntimeConfig();
  if (!runtime.trongridApiKey) throw new AppError('USDT 链上检测尚未配置', 503);
  const transfer = await findUsdtTransfer({
    toAddress: topUp.tronWallet.address,
    expectedAmount: topUp.expectedUsdt,
    apiKey: runtime.trongridApiKey,
    minTimestamp: topUp.createdAt.getTime() - 10 * 60 * 1000,
  });
  if (!transfer) return null;
  await ensureTxUnused(transfer.transaction_id);
  return settleTopUp({ topUpId: topUp.id, method: 'usdt_trc20', txHash: transfer.transaction_id });
}

router.post('/topups/:topUpNo/check', customerAuth, lookupLimiter, async (req, res, next) => {
  try {
    const topUp = await prisma.walletTopUp.findFirst({ where: { topUpNo: req.params.topUpNo, userId: req.user.id }, include: { tronWallet: true } });
    if (!topUp) return res.status(404).json({ error: '充值单不存在' });
    if (topUp.status !== 'pending') return res.json({ topUpNo: topUp.topUpNo, status: topUp.status, balanceCents: req.user.balanceCents, message: topUp.status === 'paid' ? '充值已到账' : '充值单当前不可支付' });
    if (topUp.paymentMethod !== 'usdt_trc20') return res.json({ topUpNo: topUp.topUpNo, status: topUp.status, message: '等待支付通道回调确认，请稍后刷新' });
    const paid = await autoSettleUsdtTopUp(topUp);
    if (!paid) return res.json({ topUpNo: topUp.topUpNo, status: 'pending', message: '暂未检测到匹配的 USDT-TRC20 入账，请稍后再试' });
    res.json({ topUpNo: paid.topUpNo, status: paid.status, balanceCents: paid.balanceCents, message: '已检测到链上入账，余额已到账' });
  } catch (err) { next(err); }
});

const topUpTxSchema = z.object({ txHash: z.string().trim().min(40).max(128) });
router.post('/topups/:topUpNo/submit-tx', customerAuth, validateBody(topUpTxSchema), async (req, res, next) => {
  try {
    const topUp = await prisma.walletTopUp.findFirst({ where: { topUpNo: req.params.topUpNo, userId: req.user.id }, include: { tronWallet: true } });
    if (!topUp || topUp.paymentMethod !== 'usdt_trc20' || topUp.status !== 'pending') return res.status(404).json({ error: '未找到待支付的 USDT 充值单' });
    if (!topUp.tronWallet || !topUp.expectedUsdt) return res.status(400).json({ error: '充值单缺少收款地址，请联系客服' });
    const runtime = await getUsdtRuntimeConfig();
    if (!runtime.trongridApiKey) return res.status(503).json({ error: 'USDT 链上检测尚未配置' });
    await verifyUsdtTransfer({ txHash: req.body.txHash, toAddress: topUp.tronWallet.address, expectedAmount: topUp.expectedUsdt, apiKey: runtime.trongridApiKey, minTimestamp: topUp.createdAt.getTime() - 10 * 60 * 1000 });
    await ensureTxUnused(req.body.txHash);
    const paid = await settleTopUp({ topUpId: topUp.id, method: 'usdt_trc20', txHash: req.body.txHash });
    res.json({ topUpNo: paid.topUpNo, status: paid.status, balanceCents: paid.balanceCents });
  } catch (err) { next(err); }
});

module.exports = router;
