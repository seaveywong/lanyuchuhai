const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const fiatPayment = require('../../services/payment/fiat');
const orderService = require('../../services/order');
const { settleTopUp } = require('../../services/topup');
const logger = require('../../utils/logger');

const prisma = new PrismaClient();
const router = Router();
const sameAmount = (left, right) => Math.abs(Number(left) - Number(right)) < 0.01;

async function settle(method, body) {
  const verified = method === 'alipay' ? await fiatPayment.verifyAlipayCallback(body) : await fiatPayment.verifyWechatCallback(body);
  if (!verified) throw new Error('支付签名校验失败');
  const parsed = method === 'alipay' ? fiatPayment.parseAlipayCallback(body) : fiatPayment.parseWechatCallback(body);
  const tradeNo = parsed.trade_no || parsed.transaction_id;
  const amount = parsed.total_amount || parsed.amount;
  if (!parsed.out_trade_no || !tradeNo || !Number.isFinite(Number(amount))) throw new Error('支付回调参数不完整');
  const callbackRaw = JSON.stringify(body).slice(0, 10000);
  const topUp = await prisma.walletTopUp.findUnique({ where: { topUpNo: parsed.out_trade_no } });
  if (topUp) {
    if (!sameAmount(topUp.amountCents / 100, amount)) throw new Error('充值金额校验失败');
    return settleTopUp({ topUpId: topUp.id, method, tradeNo, callbackRaw });
  }
  const order = await prisma.order.findUnique({ where: { orderNo: parsed.out_trade_no } });
  if (!order) throw new Error('订单不存在');
  if (!sameAmount(order.totalAmount, amount)) throw new Error('订单金额校验失败');
  return orderService.settleOrderPayment({ orderId: order.id, method, tradeNo, callbackRaw });
}
router.post('/alipay', async (req, res) => {
  try { await settle('alipay', req.body); res.type('text/plain').send('success'); }
  catch (err) { logger.warn('Alipay callback rejected', { error: err.message }); res.status(400).type('text/plain').send('fail'); }
});
router.post('/wechat', async (req, res) => {
  try { await settle('wechat', req.body); res.json({ code: 'SUCCESS', message: 'OK' }); }
  catch (err) { logger.warn('Wechat callback rejected', { error: err.message }); res.status(400).json({ code: 'FAIL', message: 'FAIL' }); }
});
module.exports = router;
