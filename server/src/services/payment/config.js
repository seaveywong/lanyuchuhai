const { PrismaClient } = require('@prisma/client');
const appConfig = require('../../config');
const { decrypt } = require('../../utils/crypto');

const prisma = new PrismaClient();

const methodLabels = {
  usdt_trc20: 'USDT-TRC20',
  alipay: '支付宝',
  wechat: '微信支付',
};

function tryParseJson(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return null;
  }
}

function parsePaymentConfig(configJson) {
  if (!configJson) return {};
  if (typeof configJson === 'object') return configJson;
  const plain = tryParseJson(configJson);
  if (plain) return plain;
  try {
    return tryParseJson(decrypt(configJson)) || {};
  } catch (_) {
    return {};
  }
}

async function getPaymentConfigRows() {
  const rows = await prisma.paymentConfig.findMany();
  return rows.map((row) => ({ ...row, config: parsePaymentConfig(row.configJson) }));
}

async function isMethodReady(row) {
  if (!row || row.status !== 'active') return false;
  const cfg = row.config || {};
  if (row.method === 'site_settings') return false;
  if (row.method === 'usdt_trc20') {
    if (!cfg.trongridApiKey && !appConfig.usdt.trongridApiKey) return false;
    return (await prisma.tronWallet.count({ where: { status: 'active' } })) > 0;
  }
  if (row.method === 'alipay' || row.method === 'wechat') return !!(cfg.gatewayUrl && cfg.appId && cfg.appSecret);
  return false;
}

async function getPublicPaymentConfig() {
  const rows = await getPaymentConfigRows();
  const byMethod = new Map(rows.map((row) => [row.method, row]));
  const usdtConfig = byMethod.get('usdt_trc20')?.config || {};
  const siteConfig = byMethod.get('site_settings')?.config || {};
  const exchangeRate = parseFloat(usdtConfig.exchangeRate || appConfig.usdt.exchangeRate || 7) || 7;
  const ready = await Promise.all(rows.map(async (row) => ({ row, enabled: await isMethodReady(row) })));
  const methods = ready.filter((item) => item.enabled).map((item) => ({ method: item.row.method, label: methodLabels[item.row.method] || item.row.method }));

  return {
    methods,
    exchangeRate,
    usdt: { network: 'TRC20' },
    contact: {
      supportEnabled: siteConfig.supportEnabled !== false,
      supportTitle: siteConfig.supportTitle || '联系客服',
      supportText: siteConfig.supportText || '下单前后如需确认库存、支付或交付，请联系人工客服。',
      tgUsername: siteConfig.tgUsername || null,
      tgUrl: siteConfig.tgUrl || null,
      whatsapp: siteConfig.whatsapp || null,
      email: siteConfig.email || null,
      businessHours: siteConfig.businessHours || null,
    },
  };
}

async function getUsdtRuntimeConfig() {
  const row = await prisma.paymentConfig.findUnique({ where: { method: 'usdt_trc20' } });
  const cfg = parsePaymentConfig(row?.configJson);
  return { exchangeRate: parseFloat(cfg.exchangeRate || appConfig.usdt.exchangeRate || 7) || 7, trongridApiKey: cfg.trongridApiKey || appConfig.usdt.trongridApiKey || '' };
}

function cnyToUsdtAmount(cny, exchangeRate = 7) {
  const amount = Number(cny) / Number(exchangeRate || 7);
  return Number(amount.toFixed(6));
}

module.exports = { parsePaymentConfig, getPaymentConfigRows, getPublicPaymentConfig, getUsdtRuntimeConfig, cnyToUsdtAmount, methodLabels };
