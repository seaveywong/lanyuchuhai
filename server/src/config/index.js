require('dotenv').config();

function splitList(value, fallback = []) {
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireProductionSecret(name, value, invalidPrefixes = []) {
  if (!value) throw new Error(`${name} is required in production`);
  if (value.length < 32) throw new Error(`${name} must be at least 32 characters`);
  for (const prefix of invalidPrefixes) {
    if (value.startsWith(prefix)) throw new Error(`${name} must not use a development/default value`);
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const cardEncryptionKeyHex = process.env.CARD_ENCRYPTION_KEY || 'a'.repeat(64);

if (isProduction) {
  requireProductionSecret('JWT_ACCESS_SECRET', jwtAccessSecret, ['dev-', 'change-me']);
  requireProductionSecret('JWT_REFRESH_SECRET', jwtRefreshSecret, ['dev-', 'change-me']);
  if (!/^[a-f0-9]{64}$/i.test(cardEncryptionKeyHex)) {
    throw new Error('CARD_ENCRYPTION_KEY must be 64 hex characters in production');
  }
  if (cardEncryptionKeyHex === 'a'.repeat(64)) {
    throw new Error('CARD_ENCRYPTION_KEY must not use the development fallback in production');
  }
  if (!process.env.CORS_ORIGINS) {
    throw new Error('CORS_ORIGINS must be explicitly configured in production');
  }
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv,
  isProduction,

  app: {
    name: process.env.APP_NAME || '钥达 KeyGo',
    publicBaseUrl: process.env.BASE_URL || 'http://localhost:3000',
    allowedOrigins: splitList(
      process.env.CORS_ORIGINS,
      isProduction ? [] : ['http://localhost:5173', 'http://localhost:3000']
    ),
    adminAllowedIps: splitList(process.env.ADMIN_ALLOWED_IPS),
    trustProxy: parseInt(process.env.TRUST_PROXY || '1', 10),
  },

  databaseUrl: process.env.DATABASE_URL,
  bodyLimit: process.env.BODY_LIMIT || '1mb',
  callbackBodyLimit: process.env.CALLBACK_BODY_LIMIT || '256kb',

  jwt: {
    accessSecret: jwtAccessSecret,
    refreshSecret: jwtRefreshSecret,
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
    issuer: process.env.JWT_ISSUER || 'keygo-api',
    audience: process.env.JWT_AUDIENCE || 'keygo-admin',
  },

  cardEncryptionKey: Buffer.from(cardEncryptionKeyHex, 'hex'),

  orderAccessPin: {
    rounds: parseInt(process.env.ORDER_PIN_SALT_ROUNDS || '10', 10),
  },

  usdt: {
    trongridApiKey: process.env.TRONGRID_API_KEY,
    usdtContractAddress:
      process.env.USDT_CONTRACT_ADDRESS || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    merchantAddress: process.env.MERCHANT_WALLET_ADDRESS,
    merchantPrivateKey: process.env.MERCHANT_PRIVATE_KEY,
    minConfirmations: parseInt(process.env.USDT_MIN_CONFIRMATIONS || '19', 10),
    paymentLookbackMinutes: parseInt(process.env.USDT_LOOKBACK_MINUTES || '180', 10),
  },

  paymentGateway: {
    url: process.env.PAYMENT_GATEWAY_URL,
    appId: process.env.PAYMENT_GATEWAY_APP_ID,
    appSecret: process.env.PAYMENT_GATEWAY_APP_SECRET,
  },

  admin: {
    defaultUsername: process.env.ADMIN_DEFAULT_USERNAME || 'admin',
    defaultPassword: process.env.ADMIN_DEFAULT_PASSWORD || 'admin123',
  },
};
