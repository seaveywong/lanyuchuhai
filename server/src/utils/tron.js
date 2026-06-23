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
  const { minTimestamp = 0, limit = 20, apiKey = config.usdt.trongridApiKey } = options;

  const url = `${TRONGRID_BASE}/v1/accounts/${address}/transactions/trc20?` +
    `contract_address=${USDT_CONTRACT}&` +
    `min_timestamp=${minTimestamp}&` +
    `limit=${limit}&` +
    `only_confirmed=true&` +
    `order=block_timestamp:desc`;

  const headers = {};
  if (apiKey) {
    headers['TRON-PRO-API-KEY'] = apiKey;
  }

  const response = await fetch(url, { headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.Error || data?.error || 'TronGrid request failed');

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

async function verifyUsdtTransfer({ txHash, toAddress, expectedAmount, apiKey, minTimestamp }) {
  const transfers = await getTrc20Transactions(toAddress, { minTimestamp, limit: 200, apiKey });
  const transfer = transfers.find((item) => item.transaction_id === txHash);
  if (!transfer) throw new Error('未找到已确认的该笔 USDT 转账，请稍后重试并确认 TXID');
  if (transfer.to !== toAddress) throw new Error('该交易的收款地址不匹配');
  if (transfer.token_info?.address && transfer.token_info.address !== USDT_CONTRACT) throw new Error('该交易不是 USDT-TRC20 转账');
  const actualAmount = parseUsdtAmount(transfer.value);
  if (Math.abs(actualAmount - Number(expectedAmount)) > 0.000001) throw new Error('该交易金额与订单金额不一致');
  return transfer;
}
module.exports = { getTrc20Transactions, parseUsdtAmount, verifyUsdtTransfer };
