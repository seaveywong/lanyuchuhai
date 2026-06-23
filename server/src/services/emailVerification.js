const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const config = require('../config');
const { isEmailConfigured, sendVerificationEmail } = require('./email');
const { AppError } = require('../middleware/errorHandler');

const prisma = new PrismaClient();
const PURPOSES = ['register', 'order'];

function isEnabled() {
  return isEmailConfigured();
}

function isRequired() {
  return isEnabled() && Boolean(config.email.verificationRequired);
}

function status() {
  return { enabled: isEnabled(), required: isRequired(), ttlMinutes: config.email.codeTtlMinutes };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashCode(email, purpose, code) {
  return crypto.createHmac('sha256', config.customerJwt.secret).update(`${purpose}:${normalizeEmail(email)}:${String(code).trim()}`).digest('hex');
}

function assertPurpose(purpose) {
  if (!PURPOSES.includes(purpose)) throw new AppError('验证码用途不正确', 400);
}

async function issueEmailCode({ email, purpose, ip }) {
  assertPurpose(purpose);
  if (!isEnabled()) throw new AppError('邮件服务尚未配置，暂时无法发送验证码', 503);
  const normalizedEmail = normalizeEmail(email);
  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + config.email.codeTtlMinutes * 60 * 1000);
  await prisma.emailVerification.create({
    data: { email: normalizedEmail, purpose, codeHash: hashCode(normalizedEmail, purpose, code), expiresAt, ip },
  });
  await sendVerificationEmail(normalizedEmail, code, purpose);
  return { sent: true, expiresAt, ttlMinutes: config.email.codeTtlMinutes };
}

async function consumeEmailCode({ email, purpose, code, tx = prisma }) {
  assertPurpose(purpose);
  const normalizedEmail = normalizeEmail(email);
  const record = await tx.emailVerification.findFirst({
    where: { email: normalizedEmail, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) throw new AppError('验证码无效或已过期，请重新获取', 400);
  if (record.attempts >= 5) throw new AppError('验证码尝试次数过多，请重新获取', 429);
  const matched = crypto.timingSafeEqual(Buffer.from(record.codeHash), Buffer.from(hashCode(normalizedEmail, purpose, code)));
  if (!matched) {
    await tx.emailVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw new AppError('验证码不正确', 400);
  }
  await tx.emailVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 }, consumedAt: new Date() } });
  return true;
}

module.exports = { isEnabled, isRequired, status, issueEmailCode, consumeEmailCode };
