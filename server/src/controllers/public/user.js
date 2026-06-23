const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const config = require('../../config');
const { validateBody } = require('../../middleware/validator');
const { customerAuthLimiter } = require('../../middleware/rateLimiter');
const { customerAuth } = require('../../middleware/auth');
const { sendWelcomeEmail } = require('../../services/email');
const emailVerification = require('../../services/emailVerification');

const prisma = new PrismaClient();
const router = Router();
const credentialsSchema = z.object({
  email: z.string().email('请输入有效邮箱地址').transform((value) => value.toLowerCase().trim()),
  password: z.string().min(10, '密码至少 10 位').max(128),
  emailCode: z.string().regex(/^\d{6}$/, '请输入 6 位邮箱验证码').optional(),
});
const emailCodeSchema = z.object({
  email: z.string().email('请输入有效邮箱地址').transform((value) => value.toLowerCase().trim()),
  purpose: z.enum(['register', 'order']),
});
const publicUser = (user) => ({ id: user.id, email: user.email, balanceCents: user.balanceCents, status: user.status, emailVerifiedAt: user.emailVerifiedAt, createdAt: user.createdAt });
const signCustomerToken = (user) => jwt.sign({ id: user.id, type: 'customer' }, config.customerJwt.secret, { algorithm: 'HS256', expiresIn: config.customerJwt.expires, issuer: config.jwt.issuer, audience: 'bluereach-customer', jwtid: crypto.randomUUID() });

router.get('/auth/email-verification', (req, res) => res.json(emailVerification.status()));

router.post('/auth/email-code', customerAuthLimiter, validateBody(emailCodeSchema), async (req, res, next) => {
  try {
    const result = await emailVerification.issueEmailCode({ email: req.body.email, purpose: req.body.purpose, ip: req.ip });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/auth/register', customerAuthLimiter, validateBody(credentialsSchema), async (req, res, next) => {
  try {
    const existing = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (existing) return res.status(409).json({ error: '该邮箱已注册，请直接登录' });
    let emailVerifiedAt = null;
    if (emailVerification.isRequired() || req.body.emailCode) {
      if (!req.body.emailCode) return res.status(400).json({ error: '请先获取并填写邮箱验证码' });
      await emailVerification.consumeEmailCode({ email: req.body.email, purpose: 'register', code: req.body.emailCode });
      emailVerifiedAt = new Date();
    }
    const user = await prisma.user.create({ data: { email: req.body.email, passwordHash: await bcrypt.hash(req.body.password, 12), emailVerifiedAt } });
    void sendWelcomeEmail(user.email).catch(() => undefined);
    res.status(201).json({ accessToken: signCustomerToken(user), user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post('/auth/login', customerAuthLimiter, validateBody(credentialsSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    const valid = user ? await bcrypt.compare(req.body.password, user.passwordHash) : false;
    if (!user || !valid || user.status !== 'active') return res.status(401).json({ error: '邮箱或密码错误' });
    res.json({ accessToken: signCustomerToken(user), user: publicUser(user) });
  } catch (err) { next(err); }
});

router.get('/auth/me', customerAuth, (req, res) => res.json({ user: publicUser(req.user) }));
router.get('/auth/ledger', customerAuth, async (req, res, next) => {
  try {
    const entries = await prisma.walletLedger.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, amountCents: true, balanceBeforeCents: true, balanceAfterCents: true, type: true, note: true, createdAt: true, order: { select: { orderNo: true } } } });
    res.json({ entries });
  } catch (err) { next(err); }
});

module.exports = router;
