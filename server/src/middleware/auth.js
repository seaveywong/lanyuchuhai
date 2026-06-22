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

module.exports = { adminAuth };
