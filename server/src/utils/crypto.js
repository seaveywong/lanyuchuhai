const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const LEGACY_IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY = config.cardEncryptionKey;

if (KEY.length !== 32) {
  throw new Error('CARD_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
}

function encrypt(plaintext) {
  if (typeof plaintext !== 'string') {
    throw new TypeError('encrypt() expects a string');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
}

function decrypt(encryptedData) {
  if (typeof encryptedData !== 'string') {
    throw new TypeError('decrypt() expects a string');
  }

  const parts = encryptedData.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const encrypted = Buffer.from(parts[2], 'base64');

  if (![IV_LENGTH, LEGACY_IV_LENGTH].includes(iv.length) || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted payload');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8');
}

function hash(content) {
  return crypto.createHash('sha256').update(String(content)).digest('hex');
}

function hmac(content) {
  return crypto.createHmac('sha256', KEY).update(String(content)).digest('hex');
}

module.exports = { encrypt, decrypt, hash, hmac };
