const config = require('../config');
const logger = require('../utils/logger');

function isEmailConfigured() {
  return config.email.provider === 'resend' && Boolean(config.email.resendApiKey) && Boolean(config.email.from);
}

async function sendTransactionalEmail({ to, subject, html, text }) {
  if (!isEmailConfigured()) {
    logger.info('Transactional email skipped: provider is not configured');
    return { sent: false, skipped: true };
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.email.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.email.from, to: [to], subject, html, text }),
  });
  if (!response.ok) {
    logger.warn('Transactional email delivery failed', { status: response.status });
    throw new Error('邮件服务暂时不可用');
  }
  return { sent: true };
}

function publicUrl(path) {
  return new URL(path, config.app.publicBaseUrl).toString();
}

function sendVerificationEmail(email, code, purpose) {
  const label = purpose === 'register' ? '注册账户' : '确认下单邮箱';
  return sendTransactionalEmail({
    to: email,
    subject: `蓝域出海${label}验证码`,
    text: `你的验证码是 ${code}，10 分钟内有效。若不是你本人操作，请忽略本邮件。`,
    html: `<p>你的验证码是：</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>验证码 10 分钟内有效。若不是你本人操作，请忽略本邮件。</p>`,
  });
}

function sendWelcomeEmail(email) {
  const accountUrl = publicUrl('/account');
  return sendTransactionalEmail({
    to: email,
    subject: '蓝域出海账户创建成功',
    text: `你的账户已创建。访问 ${accountUrl} 查看余额与订单信息。`,
    html: `<p>你的蓝域出海账户已创建。</p><p><a href="${accountUrl}">查看账户与余额</a></p>`,
  });
}

function sendOrderEmail(email, orderNo, isPaid) {
  const orderUrl = publicUrl('/order/' + encodeURIComponent(orderNo));
  const stateText = isPaid ? '订单已支付完成，请通过订单页面查看交付内容。' : '订单已创建，请在订单页面完成支付。';
  return sendTransactionalEmail({
    to: email,
    subject: `蓝域出海订单 ${orderNo}`,
    text: `${stateText}\n${orderUrl}\n邮件不会包含卡密，请勿回复本邮件。`,
    html: `<p>${stateText}</p><p><a href="${orderUrl}">查看订单</a></p><p>为保护账户安全，邮件不会包含卡密。</p>`,
  });
}

module.exports = { isEmailConfigured, sendTransactionalEmail, sendVerificationEmail, sendWelcomeEmail, sendOrderEmail };
