const { AppError } = require('../middleware/errorHandler');

async function allocateTronWallet(tx) {
  const [busyOrders, busyTopUps] = await Promise.all([
    tx.order.findMany({ where: { status: 'pending', tronWalletId: { not: null } }, select: { tronWalletId: true } }),
    tx.walletTopUp.findMany({ where: { status: 'pending', tronWalletId: { not: null } }, select: { tronWalletId: true } }),
  ]);
  const busyIds = [...new Set([...busyOrders, ...busyTopUps].map((item) => item.tronWalletId).filter(Boolean))];
  const where = busyIds.length ? { status: 'active', id: { notIn: busyIds } } : { status: 'active' };
  const wallet = await tx.tronWallet.findFirst({ where, orderBy: [{ priority: 'desc' }, { lastAssignedAt: 'asc' }, { id: 'asc' }] });
  if (!wallet) throw new AppError('当前没有空闲 USDT 收款地址，请稍后再试或联系人工客服', 503);
  await tx.tronWallet.update({ where: { id: wallet.id }, data: { lastAssignedAt: new Date() } });
  return wallet;
}

function isTronAddress(value) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(String(value || '').trim());
}

module.exports = { allocateTronWallet, isTronAddress };
