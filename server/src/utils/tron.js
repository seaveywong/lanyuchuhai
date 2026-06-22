/**
 * TronGrid API 封装 - USDT-TRC20 链上查询
 */
const config = require('../config');

const TRONGRID_BASE = 'https://api.trongrid.io';
const USDT_CONTRACT = config.usdt.usdtContractAddress;

/**
 * 查询 TRC20 代币转账记录
 * @param {string} address - 钱包地址
 * @param {object} options - { minTimestamp, limit }
 * @returns {Promise<Array>}
 */
async function getTrc20Transactions(address, options = {}) {
  const { minTimestamp = 0, limit = 20 } = options;

  const url = `${TRONGRID_BASE}/v1/accounts/${address}/transactions/trc20?` +
    `contract_address=${USDT_CONTRACT}&` +
    `min_timestamp=${minTimestamp}&` +
    `limit=${limit}&` +
    `only_confirmed=true&` +
    `order=block_timestamp:desc`;

  const headers = {};
  if (config.usdt.trongridApiKey) {
    headers['TRON-PRO-API-KEY'] = config.usdt.trongridApiKey;
  }

  const response = await fetch(url, { headers });
  const data = await response.json();

  if (!data.success && data.error) {
    // 地址没有交易记录时返回空
    if (data.error.includes('account not found')) {
      return [];
    }
    throw new Error(`TronGrid API error: ${data.error}`);
  }

  return data.data || [];
}

/**
 * 解析 USDT 转账金额 (USDT 有 6 位小数)
 * @param {string} rawAmount - 原始金额字符串
 * @returns {number}
 */
function parseUsdtAmount(rawAmount) {
  return parseInt(rawAmount, 10) / 1_000_000;
}

module.exports = { getTrc20Transactions, parseUsdtAmount };
