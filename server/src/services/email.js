const config = require('../config');
const logger = require('../utils/logger');

async function sendTransactionalEmail({ to, subject, html, text }) {
  if (config.email.provider !== 'resend' || !config.email.resendApiKey || !config.email.from) {
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
    throw new Error('邮件服务暂不可用');
  }
  return { sent: true };
}

function publicUrl(path) {
  return new URL(path, config.app.publicBaseUrl).toString();
}

function sendWelcomeEmail(email) {
  const accountUrl = publicUrl('/account');
  return sendTransactionalEmail({
    to: email,
    subject: 'BlueReach 账户创建成功',
    text: `你的账户已创建。访问 ${accountUrl} 查看余额与订单。`,
    html: `<p>你的 BlueReach 账户已创建。</p><p><a href="${accountUrl}">查看账户与余额</a></p>`,
  });
}

function sendOrderEmail(email, orderNo, isPaid) {
  const orderUrl = publicUrl('/order/' + encodeURIComponent(orderNo));
  const stateText = isPaid ? '订单已支付完成，请通过订单查询页面查看交付内容。' : '订单已创建，请在订单页面完成支付。';
  return sendTransactionalEmail({
    to: email,
    subject: `BlueReach 订单 ${orderNo}`,
    text: `${stateText}\n${orderUrl}\n邮件不会包含卡密，请勿回复本邮件。`,
    html: `<p>${stateText}</p><p><a href="${orderUrl}">查看订单</a></p><p>为保护账户安全，邮件不会包含卡密。</p>`,
  });
}

module.exports = { sendWelcomeEmail, sendOrderEmail };
