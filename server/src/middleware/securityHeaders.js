const config = require('../config');

function buildCsp() {
  const connectSrc = ["'self'", 'https://api.trongrid.io', ...config.app.allowedOrigins];
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: https:",
    "font-src 'self' data: https:",
    `connect-src ${Array.from(new Set(connectSrc)).join(' ')}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    config.isProduction ? 'upgrade-insecure-requests' : '',
  ].filter(Boolean).join('; ');
}

function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', buildCsp());
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  res.removeHeader('X-Powered-By');
  next();
}

module.exports = securityHeaders;
