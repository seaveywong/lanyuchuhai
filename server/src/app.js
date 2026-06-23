require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.app.trustProxy);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.app.allowedOrigins, credentials: true }));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: config.bodyLimit }));
app.use(express.urlencoded({ extended: false, limit: config.bodyLimit }));
app.use(require('./middleware/securityHeaders'));
app.use('/api/admin', require('./middleware/bruteForce').blockCheck);
app.use('/api/', apiLimiter);
app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/public', require('./controllers/public/product'));
app.use('/api/public', require('./controllers/public/order'));
app.use('/api/public', require('./controllers/public/payment'));
app.use('/api/admin', require('./controllers/admin/auth'));
app.use('/api/admin', require('./controllers/admin/product'));
app.use('/api/admin', require('./controllers/admin/inventory'));
app.use('/api/admin', require('./controllers/admin/order'));
app.use('/api/admin', require('./controllers/admin/paymentConfig'));
app.use('/api/admin', require('./controllers/admin/dashboard'));
app.use('/api/callback', require('./controllers/public/callback'));
app.use((_, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

if (require.main === module) {
  try { require('./jobs/usdtMonitor'); logger.info('USDT monitor started'); }
  catch (e) { logger.warn('USDT monitor skipped', { error: e.message }); }
  try { require('./jobs/cleanup'); logger.info('Cleanup job started'); }
  catch (e) { logger.warn('Cleanup skipped', { error: e.message }); }
  app.listen(config.port, () => logger.info('BlueReach API :' + config.port + ' [' + config.nodeEnv + ']'));
}

module.exports = app;
