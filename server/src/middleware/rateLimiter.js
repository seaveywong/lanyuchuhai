const rateLimit = require('express-rate-limit');
const config = require('../config');

const isDev = config.nodeEnv === 'development';

const commonOptions = {
  standardHeaders: true,
  legacyHeaders: false,
};

const apiLimiter = rateLimit({
  ...commonOptions,
  windowMs: 60 * 1000,
  max: isDev ? 600 : 120,
  message: { error: '请求过于频繁，请稍后再试', code: 'RATE_LIMITED' },
});

const orderLimiter = rateLimit({
  ...commonOptions,
  windowMs: 60 * 1000,
  max: isDev ? 60 : 10,
  message: { error: '下单过于频繁，请60秒后再试', code: 'ORDER_RATE_LIMITED' },
});

const lookupLimiter = rateLimit({
  ...commonOptions,
  windowMs: 60 * 1000,
  max: isDev ? 120 : 20,
  message: { error: '查询过于频繁，请稍后再试', code: 'LOOKUP_RATE_LIMITED' },
});

const adminLimiter = rateLimit({
  ...commonOptions,
  windowMs: 60 * 1000,
  max: isDev ? 120 : 60,
  message: { error: '管理接口请求过于频繁，请稍后再试', code: 'ADMIN_RATE_LIMITED' },
});

const adminLoginLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 8,
  skipSuccessfulRequests: true,
  message: { error: '登录尝试过于频繁，请稍后再试', code: 'LOGIN_RATE_LIMITED' },
});

const customerAuthLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  max: isDev ? 80 : 12,
  skipSuccessfulRequests: true,
  message: { error: '账户操作过于频繁，请稍后再试', code: 'CUSTOMER_AUTH_RATE_LIMITED' },
});

module.exports = { apiLimiter, orderLimiter, lookupLimiter, adminLimiter, adminLoginLimiter, customerAuthLimiter };
