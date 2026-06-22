/**
 * 简易日志工具
 */
const config = require('../config');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = config.nodeEnv === 'production' ? 'info' : 'debug';

function log(level, message, meta = {}) {
  if (LEVELS[level] > LEVELS[currentLevel]) return;

  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';

  const line = `[${timestamp}] [${level.toUpperCase()}] ${message} ${metaStr}`.trim();

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

module.exports = {
  error: (msg, meta) => log('error', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};
