const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const config = require('../config');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

async function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });

    if (decoded.type !== 'admin') {
      return res.status(403).json({ error: '无管理员权限' });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, role: true },
    });

    if (!admin) {
      return res.status(401).json({ error: '管理员不存在或已失效' });
    }

    req.admin = admin;
    req.tokenId = decoded.jti;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '登录已过期，请重新登录', code: 'TOKEN_EXPIRED' });
    }
    logger.warn('Invalid admin token', { error: err.message, ip: req.ip });
    return res.status(401).json({ error: '无效的登录凭证' });
  }
}

async function resolveCustomer(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  const decoded = jwt.verify(token, config.customerJwt.secret, {
    algorithms: ['HS256'],
    issuer: config.jwt.issuer,
    audience: 'bluereach-customer',
  });
  if (decoded.type !== 'customer') return null;
  return prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true, email: true, balanceCents: true, status: true, createdAt: true } });
}

async function customerAuth(req, res, next) {
  try {
    const user = await resolveCustomer(req);
    if (!user || user.status !== 'active') return res.status(401).json({ error: '请先登录账户' });
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: '登录已过期，请重新登录' });
    return res.status(401).json({ error: '无效的账户凭证' });
  }
}

async function optionalCustomerAuth(req, res, next) {
  if (!req.headers.authorization?.startsWith('Bearer ')) return next();
  return customerAuth(req, res, next);
}

module.exports = { adminAuth, customerAuth, optionalCustomerAuth };
