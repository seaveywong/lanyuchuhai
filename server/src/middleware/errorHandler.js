/**
 * 统一错误处理中间件
 */
const logger = require('../utils/logger');
const config = require('../config');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const isProduction = config.nodeEnv === 'production';

  logger.error('Unhandled error', {
    message: err.message,
    stack: isProduction ? undefined : err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Prisma 已知错误
  if (err.code && err.code.startsWith('P')) {
    return res.status(400).json({
      error: '数据操作异常',
      code: err.code,
      message: isProduction ? undefined : err.message,
    });
  }

  // 自定义业务错误
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  res.status(500).json({
    error: isProduction ? '服务器内部错误，请稍后再试' : err.message,
  });
}

/**
 * 自定义业务错误类
 */
class AppError extends Error {
  constructor(message, statusCode = 400, code = 'APP_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = { errorHandler, AppError };
