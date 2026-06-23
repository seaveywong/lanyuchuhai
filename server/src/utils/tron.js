/**
 * TronGrid API 封装 - USDT-TRC20 链上查询
 */
const config = require('../config');

const TRONGRID_BASE = 'https://api.trongrid.io';
const USDT_CONTRACT = config.usdt.usdtContractAddress;

async function getTrc20Transactions(address, options = {}) {
  const { minTimestamp = 0, limit = 20, apiKey = config.usdt.trongridApiKey } = options;
  const url = `${TRONGRID_BASE}/v1/accounts/${address}/transactions/trc20?` +
    `contract_address=${USDT_CONTRACT}&` +
    `min_timestamp=${minTimestamp}&` +
    `limit=${limit}&` +
    `only_confirmed=true&` +
    `order=block_timestamp:desc`;
  const headers = {};
  if (apiKey) headers['TRON-PRO-API-KEY'] = apiKey;
  const response = await fetch(url, { headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.Error || data?.error || 'TronGrid request failed');
  if (!data.success && data.error) {
    if (data.error.includes('account not found')) return [];
    throw new Error(`TronGrid API error: ${data.error}`);
  }
  return data.data || [];
}

function parseUsdtAmount(rawAmount) {
  return parseInt(rawAmount, 10) / 1_000_000;
}

function isExpectedUsdtTransfer(transfer, toAddress, expectedAmount) {
  if (!transfer || transfer.to !== toAddress) return false;
  if (transfer.token_info?.address && transfer.token_info.address !== USDT_CONTRACT) return false;
  const actualAmount = parseUsdtAmount(transfer.value);
  return Math.abs(actualAmount - Number(expectedAmount)) <= 0.000001;
}

async function findUsdtTransfer({ toAddress, expectedAmount, apiKey, minTimestamp }) {
  const transfers = await getTrc20Transactions(toAddress, { minTimestamp, limit: 200, apiKey });
  return transfers.find((item) => isExpectedUsdtTransfer(item, toAddress, expectedAmount)) || null;
}

async function verifyUsdtTransfer({ txHash, toAddress, expectedAmount, apiKey, minTimestamp }) {
  const transfers = await getTrc20Transactions(toAddress, { minTimestamp, limit: 200, apiKey });
  const transfer = transfers.find((item) => item.transaction_id === txHash);
  if (!transfer) throw new Error('未找到已确认的该笔 USDT 转账，请稍后重试并确认 TXID');
  if (!isExpectedUsdtTransfer(transfer, toAddress, expectedAmount)) throw new Error('该交易的收款地址或金额与订单不一致');
  return transfer;
}

module.exports = { getTrc20Transactions, parseUsdtAmount, findUsdtTransfer, verifyUsdtTransfer };
