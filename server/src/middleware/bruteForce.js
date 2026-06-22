/**
 * 防爆破中间件
 * - 同一IP连续5次登录失败 → 锁定15分钟
 * - 同一IP累计20次失败 → 加入黑名单24小时
 * - 登录成功自动清除该IP的失败记录
 */
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const MAX_ATTEMPTS = 5;           // 连续失败次数
const LOCKOUT_MINUTES = 15;       // 锁定时长
const BLACKLIST_THRESHOLD = 20;   // 累计失败触发黑名单
const BLACKLIST_HOURS = 24;       // 黑名单时长

/**
 * 检查IP是否被封禁
 */
async function isBlocked(ip) {
  const blacklist = await prisma.ipBlacklist.findUnique({ where: { ip } });
  if (!blacklist || !blacklist.blockedUntil) return false;

  if (new Date() < blacklist.blockedUntil) {
    return true; // 仍在封禁期
  }

  // 封禁已过期，清理
  await prisma.ipBlacklist.delete({ where: { ip } }).catch(() => {});
  return false;
}

/**
 * 检查IP是否在锁定期（连续失败5次）
 */
async function isLockedOut(ip) {
  const recentAttempts = await prisma.loginAttempt.findMany({
    where: {
      ip,
      success: false,
      createdAt: { gte: new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_ATTEMPTS,
  });

  if (recentAttempts.length < MAX_ATTEMPTS) return false;

  // 最后5次都失败了
  const allRecent = recentAttempts.every(a => !a.success);
  return allRecent;
}

/**
 * 记录登录尝试
 */
async function recordAttempt(ip, username, success) {
  await prisma.loginAttempt.create({
    data: { ip, username, success },
  });

  // 成功登录 → 清除该IP的失败记录
  if (success) {
    await prisma.loginAttempt.deleteMany({ where: { ip } }).catch(() => {});
    await prisma.ipBlacklist.delete({ where: { ip } }).catch(() => {});
    return;
  }

  // 失败 → 检查是否需要加黑名单
  const totalFailures = await prisma.loginAttempt.count({
    where: { ip, success: false },
  });

  if (totalFailures >= BLACKLIST_THRESHOLD) {
    const blockedUntil = new Date(Date.now() + BLACKLIST_HOURS * 60 * 60 * 1000);
    await prisma.ipBlacklist.upsert({
      where: { ip },
      create: {
        ip,
        reason: `超过${BLACKLIST_THRESHOLD}次登录失败`,
        blockedUntil,
      },
      update: { blockedUntil, reason: `超过${BLACKLIST_THRESHOLD}次登录失败` },
    });
    logger.warn('IP blacklisted', { ip, totalFailures, blockedUntil });
  }
}

/**
 * Express 中间件 — 检查是否被封禁
 */
function blockCheck(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress;
  isBlocked(ip).then(blocked => {
    if (blocked) {
      return res.status(403).json({
        error: 'IP已被临时封禁，请稍后再试',
        code: 'IP_BLOCKED',
      });
    }
    next();
  }).catch(next);
}

module.exports = {
  isBlocked,
  isLockedOut,
  recordAttempt,
  blockCheck,
  MAX_ATTEMPTS,
  LOCKOUT_MINUTES,
};
