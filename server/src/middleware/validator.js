/**
 * Zod 输入校验中间件工厂
 * 用法: validate(validateSchema(req) => zodSchema)
 */
const { ZodError } = require('zod');

/**
 * 校验请求体
 * @param {import('zod').ZodSchema} schema
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(400).json({ error: '参数校验失败', details: errors });
      }
      next(err);
    }
  };
}

/**
 * 校验请求查询参数
 * @param {import('zod').ZodSchema} schema
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(400).json({ error: '参数校验失败', details: errors });
      }
      next(err);
    }
  };
}

module.exports = { validateBody, validateQuery };
