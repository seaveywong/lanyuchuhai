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

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: config.nodeEnv === 'production'
    ? (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.set('trust proxy', 1);

// Security headers
app.use(require('./middleware/securityHeaders'));

// IP blacklist check for admin routes
app.use('/api/admin', require('./middleware/bruteForce').blockCheck);

// Rate limiting
app.use('/api/', apiLimiter);

// Health
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
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

// 404
app.use((_, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use(errorHandler);

// Start
if (require.main === module) {
  try { require('./jobs/usdtMonitor'); logger.info('USDT monitor started'); }
  catch (e) { logger.warn('USDT monitor skipped'); }

  try { require('./jobs/cleanup'); logger.info('Cleanup job started'); }
  catch (e) { logger.warn('Cleanup skipped'); }

  app.listen(config.port, () => {
    logger.info(`BlueReach API :${config.port} [${config.nodeEnv}]`);
  });
}

module.exports = app;
