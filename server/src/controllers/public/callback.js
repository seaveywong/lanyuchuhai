const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const fiatPayment = require('../../services/payment/fiat');
const orderService = require('../../services/order');
const logger = require('../../utils/logger');

const prisma = new PrismaClient();
const router = Router();

function isAmountMatched(orderAmount, callbackAmount, tolerance = 0.01) {
  return Math.abs(parseFloat(orderAmount) - parseFloat(callbackAmount)) <= tolerance;
}

async function ensurePaymentNotReused({ tradeNo, txHash }) {
  if (!tradeNo && !txHash) return null;
  return prisma.payment.findFirst({
    where: {
      OR: [
        tradeNo ? { tradeNo } : undefined,
        txHash ? { txHash } : undefined,
      ].filter(Boolean),
    },
  });
}

router.post('/alipay', async (req, res) => {
  try {
    logger.info('Alipay callback received', { body: JSON.stringify(req.body).slice(0, 2000) });

    const verified = await fiatPayment.verifyAlipayCallback(req.body);
    if (!verified) {
      logger.warn('Alipay callback verification failed');
      return res.status(400).send('fail');
    }

    const { out_trade_no, trade_no, total_amount } = fiatPayment.parseAlipayCallback(req.body);
    const order = await prisma.order.findUnique({ where: { orderNo: out_trade_no } });

    if (!order) {
      logger.error('Order not found for alipay callback', { out_trade_no });
      return res.status(404).send('fail');
    }

    if (!isAmountMatched(order.totalAmount, total_amount)) {
      logger.warn('Alipay callback amount mismatch', {
        orderNo: out_trade_no,
        expected: order.totalAmount,
        received: total_amount,
      });
      return res.status(400).send('fail');
    }

    if (order.status === 'paid') return res.send('success');

    const existingPayment = await ensurePaymentNotReused({ tradeNo: trade_no });
    if (!existingPayment) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          method: 'alipay',
          amount: parseFloat(total_amount),
          currency: 'CNY',
          tradeNo: trade_no,
          status: 'success',
          callbackRaw: JSON.stringify(req.body).slice(0, 10000),
        },
      });
    }

    await orderService.confirmPayment(order.id, 'alipay', trade_no);
    logger.info('Alipay payment confirmed', { orderNo: out_trade_no, trade_no });
    res.send('success');
  } catch (err) {
    logger.error('Alipay callback error', { error: err.message });
    res.status(500).send('fail');
  }
});

router.post('/wechat', async (req, res) => {
  try {
    logger.info('Wechat callback received', { body: JSON.stringify(req.body).slice(0, 2000) });

    const verified = await fiatPayment.verifyWechatCallback(req.body);
    if (!verified) {
      logger.warn('Wechat callback verification failed');
      return res.status(400).json({ code: 'FAIL', message: '签名验证失败' });
    }

    const { out_trade_no, transaction_id, amount } = fiatPayment.parseWechatCallback(req.body);
    const order = await prisma.order.findUnique({ where: { orderNo: out_trade_no } });

    if (!order) return res.status(404).json({ code: 'FAIL', message: '订单不存在' });

    if (!isAmountMatched(order.totalAmount, amount)) {
      logger.warn('Wechat callback amount mismatch', {
        orderNo: out_trade_no,
        expected: order.totalAmount,
        received: amount,
      });
      return res.status(400).json({ code: 'FAIL', message: '金额校验失败' });
    }

    if (order.status === 'paid') return res.json({ code: 'SUCCESS' });

    const existingPayment = await ensurePaymentNotReused({ tradeNo: transaction_id });
    if (!existingPayment) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          method: 'wechat',
          amount: parseFloat(amount),
          currency: 'CNY',
          tradeNo: transaction_id,
          status: 'success',
          callbackRaw: JSON.stringify(req.body).slice(0, 10000),
        },
      });
    }

    await orderService.confirmPayment(order.id, 'wechat', transaction_id);
    logger.info('Wechat payment confirmed', { orderNo: out_trade_no, transaction_id });
    res.json({ code: 'SUCCESS', message: 'OK' });
  } catch (err) {
    logger.error('Wechat callback error', { error: err.message });
    res.status(500).json({ code: 'FAIL', message: err.message });
  }
});

module.exports = router;
