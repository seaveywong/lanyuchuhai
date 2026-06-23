const crypto = require('crypto');
const logger = require('../../utils/logger');
const { getPaymentConfigRows } = require('./config');

async function getRuntimeGateway(method) {
  const rows = await getPaymentConfigRows();
  const row = rows.find((item) => item.method === method && item.status === 'active');
  const cfg = row?.config || {};
  if (!cfg.gatewayUrl || !cfg.appId || !cfg.appSecret) return null;
  return cfg;
}

async function createPaymentUrl(order, method) {
  const gateway = await getRuntimeGateway(method);
  if (!gateway) {
    logger.warn('Payment gateway not configured', { method, orderNo: order.orderNo });
    throw new Error('支付通道未配置，请联系客服');
  }

  const params = {
    pid: gateway.appId,
    type: method === 'alipay' ? 'alipay' : 'wxpay',
    out_trade_no: order.orderNo,
    notify_url: gateway.notifyUrl || `${getBaseUrl()}/api/callback/${method}`,
    return_url: gateway.returnUrl || `${getBaseUrl()}${order.returnPath || '/order/' + order.orderNo}`,
    name: gateway.productName || '数字商品',
    money: Number(order.totalAmount).toFixed(2),
    sign_type: 'MD5',
  };
  params.sign = signParams(params, gateway.appSecret);

  return `${gateway.gatewayUrl.replace(/\/+$/, '')}/submit.php?${new URLSearchParams(params).toString()}`;
}

async function verifyAlipayCallback(body) {
  const gateway = await getRuntimeGateway('alipay');
  if (!gateway) return false;
  const sign = body.sign;
  const params = { ...body };
  delete params.sign;
  delete params.sign_type;
  return sign === signParams(params, gateway.appSecret);
}

async function verifyWechatCallback(body) {
  const gateway = await getRuntimeGateway('wechat');
  if (!gateway) return false;
  const sign = body.sign;
  if (!sign) return true;
  const params = { ...body };
  delete params.sign;
  delete params.sign_type;
  return sign === signParams(params, gateway.appSecret);
}

function parseAlipayCallback(body) {
  return { out_trade_no: body.out_trade_no, trade_no: body.trade_no, total_amount: body.money || body.total_amount };
}

function parseWechatCallback(body) {
  return { out_trade_no: body.out_trade_no, transaction_id: body.transaction_id || body.trade_no, amount: parseFloat(body.money || body.total_fee || 0) / (body.total_fee ? 100 : 1) };
}

function signParams(params, secret) {
  const signStr = Object.keys(params)
    .sort()
    .filter((key) => params[key] !== '' && params[key] !== undefined && key !== 'sign')
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('md5').update(signStr + secret).digest('hex');
}

function getBaseUrl() {
  return process.env.BASE_URL || 'http://localhost:3000';
}

module.exports = { createPaymentUrl, verifyAlipayCallback, verifyWechatCallback, parseAlipayCallback, parseWechatCallback };
