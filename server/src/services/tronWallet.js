const { AppError } = require('../middleware/errorHandler');

async function allocateTronWallet(tx) {
  const wallet = await tx.tronWallet.findFirst({ where: { status: 'active' }, orderBy: [{ priority: 'desc' }, { lastAssignedAt: 'asc' }, { id: 'asc' }] });
  if (!wallet) throw new AppError('USDT 收款地址暂未配置，请联系人工客服', 503);
  await tx.tronWallet.update({ where: { id: wallet.id }, data: { lastAssignedAt: new Date() } });
  return wallet;
}

function isTronAddress(value) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(String(value || '').trim());
}

module.exports = { allocateTronWallet, isTronAddress };
