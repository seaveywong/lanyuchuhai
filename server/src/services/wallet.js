const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middleware/errorHandler');

const prisma = new PrismaClient();
const MAX_BALANCE_CENTS = 100000000;

function toCents(amount) {
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new AppError('金额必须大于 0', 400);
  return cents;
}

async function appendLedger(tx, { userId, amountCents, type, orderId = null, adminId = null, note = null, reference = null }) {
  if (!Number.isSafeInteger(amountCents) || amountCents === 0) throw new AppError('无效的余额变动', 400);
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'active') throw new AppError('用户不存在或已停用', 404);
  const balanceAfterCents = user.balanceCents + amountCents;
  if (balanceAfterCents < 0) throw new AppError('余额不足', 400);
  if (balanceAfterCents > MAX_BALANCE_CENTS) throw new AppError('余额超过账户上限', 400);
  await tx.user.update({ where: { id: user.id }, data: { balanceCents: balanceAfterCents } });
  return tx.walletLedger.create({ data: { userId: user.id, orderId, adminId, amountCents, balanceAfterCents, type, note: note || null, reference: reference || crypto.randomUUID() } });
}

async function creditUser({ userId, amount, type, note, adminId }) {
  const amountCents = toCents(amount);
  return prisma.$transaction((tx) => appendLedger(tx, { userId, amountCents, type, note, adminId }));
}

module.exports = { appendLedger, creditUser };
