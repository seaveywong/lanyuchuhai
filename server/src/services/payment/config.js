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

function isMethodReady(row) {
  if (!row || row.status !== 'active') return false;
  const cfg = row.config || {};
  if (row.method === 'site_settings') return false;
  if (row.method === 'usdt_trc20') return !!cfg.merchantAddress;
  if (row.method === 'alipay' || row.method === 'wechat') return !!(cfg.gatewayUrl && cfg.appId && cfg.appSecret);
  return false;
}

async function getPublicPaymentConfig() {
  const rows = await getPaymentConfigRows();
  const byMethod = new Map(rows.map((row) => [row.method, row]));
  const usdtConfig = byMethod.get('usdt_trc20')?.config || {};
  const siteConfig = byMethod.get('site_settings')?.config || {};
  const exchangeRate = parseFloat(usdtConfig.exchangeRate || appConfig.usdt.exchangeRate || 7) || 7;
  const merchantAddress = usdtConfig.merchantAddress || appConfig.usdt.merchantAddress || null;
  const methods = rows
    .filter(isMethodReady)
    .map((row) => ({ method: row.method, label: methodLabels[row.method] || row.method }));

  return {
    methods,
    exchangeRate,
    usdt: { network: 'TRC20', walletAddress: merchantAddress },
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
  const publicConfig = await getPublicPaymentConfig();
  return { exchangeRate: publicConfig.exchangeRate, merchantAddress: publicConfig.usdt.walletAddress };
}

function cnyToUsdtAmount(cny, exchangeRate = 7) {
  const amount = Number(cny) / Number(exchangeRate || 7);
  return Math.ceil(amount * 2) / 2;
}

module.exports = { parsePaymentConfig, getPaymentConfigRows, getPublicPaymentConfig, getUsdtRuntimeConfig, cnyToUsdtAmount, methodLabels };
