/**
 * 法币支付服务 — 支付宝/微信
 * 通过第三方支付网关 (如 易支付/V免签) 接入
 * 生产环境接入真实网关，当前为接口定义 + 简易验签逻辑
 */
const crypto = require('crypto');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * 生成支付链接 (通过第三方网关)
 * @param {object} order - 订单对象
 * @param {string} method - 'alipay' | 'wechat'
 * @returns {Promise<string>} 支付链接
 */
async function createPaymentUrl(order, method) {
  const gatewayUrl = config.paymentGateway.url;
  const appId = config.paymentGateway.appId;
  const appSecret = config.paymentGateway.appSecret;

  if (!gatewayUrl || !appId) {
    logger.warn('Payment gateway not configured, using mock');
    return `/mock-payment?orderNo=${order.orderNo}&method=${method}&amount=${order.totalAmount}`;
  }

  const params = {
    pid: appId,
    type: method === 'alipay' ? 'alipay' : 'wxpay',
    out_trade_no: order.orderNo,
    notify_url: `${getBaseUrl()}/api/callback/${method}`,
    return_url: `${getBaseUrl()}/order/${order.orderNo}`,
    name: '数字商品',
    money: order.totalAmount.toString(),
    sign_type: 'MD5',
  };

  // 签名
  params.sign = signParams(params, appSecret);

  // 构建支付链接
  const query = new URLSearchParams(params).toString();
  return `${gatewayUrl}/submit.php?${query}`;
}

/**
 * 验证支付宝回调签名
 */
async function verifyAlipayCallback(body) {
  const appSecret = config.paymentGateway.appSecret;
  if (!appSecret) return true; // 未配置时跳过验证（仅开发环境）

  const sign = body.sign;
  const params = { ...body };
  delete params.sign;
  delete params.sign_type;

  const expectedSign = signParams(params, appSecret);
  return sign === expectedSign;
}

/**
 * 验证微信回调签名
 */
async function verifyWechatCallback(body) {
  // XML 解析 + 签名验证
  // 简化实现，生产环境使用完整验签
  const appSecret = config.paymentGateway.appSecret;
  if (!appSecret) return true;
  return true; // TODO: 实现微信 XML 验签
}

/**
 * 解析支付宝回调数据
 */
function parseAlipayCallback(body) {
  return {
    out_trade_no: body.out_trade_no,
    trade_no: body.trade_no,
    total_amount: body.money || body.total_amount,
  };
}

/**
 * 解析微信回调数据
 */
function parseWechatCallback(body) {
  return {
    out_trade_no: body.out_trade_no,
    transaction_id: body.transaction_id,
    amount: parseFloat(body.total_fee || 0) / 100,
  };
}

// ========== 工具函数 ==========

function signParams(params, secret) {
  const sortedKeys = Object.keys(params).sort();
  const signStr = sortedKeys
    .filter((k) => params[k] !== '' && params[k] !== undefined && k !== 'sign')
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('md5').update(signStr + secret).digest('hex');
}

function getBaseUrl() {
  return process.env.BASE_URL || `http://localhost:${config.port}`;
}

module.exports = {
  createPaymentUrl,
  verifyAlipayCallback,
  verifyWechatCallback,
  parseAlipayCallback,
  parseWechatCallback,
};
