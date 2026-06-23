
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { encrypt } = require('../src/utils/crypto');

const prisma = new PrismaClient();

async function upsertCategory(data) {
  return prisma.category.upsert({ where: { slug: data.slug }, update: data, create: data });
}

async function upsertProductByName(name, data, previousNames = []) {
  const existing = await prisma.product.findFirst({ where: { OR: [{ name }, ...previousNames.map((item) => ({ name: item }))] } });
  if (existing) return prisma.product.update({ where: { id: existing.id }, data: { name, ...data } });
  return prisma.product.create({ data: { name, ...data } });
}

async function ensurePaymentConfig(method, status, config) {
  const existing = await prisma.paymentConfig.findUnique({ where: { method } });
  if (existing) return existing;
  return prisma.paymentConfig.create({ data: { method, status, configJson: encrypt(JSON.stringify(config)) } });
}

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123456!';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.admin.upsert({ where: { username: 'admin' }, update: { passwordHash, role: 'admin' }, create: { username: 'admin', passwordHash, role: 'admin' } });

  const roots = {};
  for (const item of [
    { name: 'Facebook', slug: 'facebook', sortOrder: 10 },
    { name: 'Google', slug: 'google', sortOrder: 20 },
    { name: 'Apple', slug: 'apple', sortOrder: 30 },
    { name: 'ChatGPT', slug: 'chatgpt', sortOrder: 40 },
    { name: '鍏朵粬骞冲彴', slug: 'other-platforms', sortOrder: 90 },
  ]) roots[item.slug] = await upsertCategory({ ...item, parentId: null, status: 'active' });

  const categories = {};
  for (const item of [
    { name: 'Facebook 璐﹀彿', slug: 'facebook-account', parent: 'facebook', sortOrder: 11 },
    { name: 'Facebook 骞垮憡璐︽埛', slug: 'fb-ad-account', parent: 'facebook', sortOrder: 12 },
    { name: 'Facebook BM', slug: 'fb-bm', parent: 'facebook', sortOrder: 13 },
    { name: 'Google Ads', slug: 'google-ads', parent: 'google', sortOrder: 21 },
    { name: 'Apple ID', slug: 'apple-id', parent: 'apple', sortOrder: 31 },
    { name: 'ChatGPT 璐﹀彿', slug: 'chatgpt-account', parent: 'chatgpt', sortOrder: 41 },
    { name: '鍏朵粬璐﹀彿', slug: 'other', parent: 'other-platforms', sortOrder: 91 },
  ]) categories[item.slug] = await upsertCategory({ name: item.name, slug: item.slug, sortOrder: item.sortOrder, status: 'active', parentId: roots[item.parent].id });

  await prisma.category.updateMany({ where: { parentId: null, slug: { notIn: Object.keys(roots) } }, data: { status: 'inactive' } });

  await upsertProductByName('Facebook 骞垮憡璐︽埛', {
    categoryId: categories['fb-ad-account'].id,
    description: '绋冲畾鑰佸彿骞垮憡璐︽埛锛岄€傚悎璺ㄥ鍥㈤槦蹇€熷惎鍔ㄦ姇鏀俱€?,
    price: 1299,
    currency: 'CNY',
    coverImage: '/assets/product-facebook-ad.svg',
    stockVisible: true,
    sortOrder: 10,
    status: 'active',
  }, ['Facebook Verified Ad Account']);

  await upsertProductByName('Facebook BM 璧勬簮鍖?, {
    categoryId: categories['fb-bm'].id,
    description: '閫傚悎浠ｇ悊鍟嗗拰璺ㄥ鍥㈤槦鐨?Business Manager 璧勬簮鍖呫€?,
    price: 2499,
    currency: 'CNY',
    coverImage: '/assets/product-facebook-bm.svg',
    stockVisible: true,
    sortOrder: 20,
    status: 'active',
  }, ['Facebook BM Portfolio']);

  await upsertProductByName('璺ㄥ璐﹀彿缁勫悎鍖?, {
    categoryId: categories.other.id,
    description: '鐢ㄤ簬娴嬭瘯澶氫釜鑾峰娓犻亾鐨勮处鍙疯祫婧愮粍鍚堛€?,
    price: 799,
    currency: 'CNY',
    coverImage: '/assets/product-bundle.svg',
    stockVisible: true,
    sortOrder: 30,
    status: 'active',
  }, ['Cross-border Account Bundle']);

  await ensurePaymentConfig('site_settings', 'active', { supportEnabled: true, supportTitle: '鑱旂郴瀹㈡湇', supportText: '涓嬪崟鍓嶅悗濡傞渶纭搴撳瓨銆佹敮浠樻垨浜や粯锛岃鑱旂郴浜哄伐瀹㈡湇銆?, tgUsername: '', tgUrl: '', whatsapp: '', email: '', businessHours: '宸ヤ綔鏃?10:00-22:00' });
  await ensurePaymentConfig('usdt_trc20', 'inactive', { exchangeRate: 7, merchantAddress: '', trongridApiKey: '' });
  await ensurePaymentConfig('alipay', 'inactive', { gatewayType: 'epay', gatewayUrl: '', appId: '', appSecret: '', productName: '鏁板瓧鍟嗗搧', notifyUrl: '', returnUrl: '' });
  await ensurePaymentConfig('wechat', 'inactive', { gatewayType: 'epay', gatewayUrl: '', appId: '', appSecret: '', productName: '鏁板瓧鍟嗗搧', notifyUrl: '', returnUrl: '' });

  console.log('Seed complete. Admin: admin / ' + adminPassword);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });

