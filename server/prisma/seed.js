/**
 * 数据库 Seed — 管理员 + 演示商品 + 演示库存
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../src/config');

const prisma = new PrismaClient();

// AES-256-GCM 加密
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY = config.cardEncryptionKey;

function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted}`;
}

function hash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function main() {
  console.log('🌱 Seeding database...\n');

  // ====== 1. 管理员 ======
  const passwordHash = await bcrypt.hash(config.admin.defaultPassword, 12);
  await prisma.admin.upsert({
    where: { username: config.admin.defaultUsername },
    update: {},
    create: { username: config.admin.defaultUsername, passwordHash, role: 'admin' },
  });
  console.log(`✅ 管理员: ${config.admin.defaultUsername} / <来自环境变量>`);

  // ====== 2. 分类 ======
  const catData = [
    { name: 'Facebook 账号', slug: 'facebook-account', sortOrder: 1 },
    { name: 'FB 广告账号', slug: 'fb-ad-account', sortOrder: 2 },
    { name: 'FB BM 账号', slug: 'fb-bm', sortOrder: 3 },
    { name: '其他平台账号', slug: 'other', sortOrder: 4 },
  ];
  const categories = {};
  for (const c of catData) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
    categories[c.slug] = cat;
  }
  console.log(`✅ 分类: ${catData.length} 个`);

  // ====== 3. 演示商品 ======
  const productData = [
    { categorySlug: 'facebook-account', name: 'Facebook 老号（耐用号）', description: '注册时间超过1年，带好友，适合广告投放，稳定耐用', price: 35.00, currency: 'CNY' },
    { categorySlug: 'facebook-account', name: 'Facebook 新号（当天注册）', description: '当天注册新号，适合批量注册应用', price: 5.00, currency: 'CNY' },
    { categorySlug: 'facebook-account', name: 'Facebook 二解号', description: '已过二次验证，可直接登录使用', price: 25.00, currency: 'CNY' },
    { categorySlug: 'fb-ad-account', name: 'FB 广告账户（限额$50）', description: '已开通广告功能，日限额$50，适合测品', price: 150.00, currency: 'CNY' },
    { categorySlug: 'fb-ad-account', name: 'FB 广告账户（不限额度）', description: '无日限额广告账户，稳定投放', price: 500.00, currency: 'CNY' },
    { categorySlug: 'fb-bm', name: 'BM 商务管理平台（基础版）', description: '基础 BM，可创建3个广告账户', price: 200.00, currency: 'CNY' },
    { categorySlug: 'fb-bm', name: 'BM 商务管理平台（企业版）', description: '企业认证 BM，可创建无限广告账户', price: 800.00, currency: 'CNY' },
    { categorySlug: 'other', name: 'Google Ads 账号', description: '已验证 Google Ads 账号，可直接投放广告', price: 100.00, currency: 'CNY' },
  ];

  const createdProducts = [];
  for (const p of productData) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) {
      createdProducts.push(existing);
    } else {
      const product = await prisma.product.create({
        data: {
          categoryId: categories[p.categorySlug].id,
          name: p.name,
          description: p.description,
          price: p.price,
          currency: 'CNY',
          status: 'active',
          sortOrder: productData.indexOf(p),
        },
      });
      createdProducts.push(product);
    }
  }
  console.log(`✅ 商品: ${createdProducts.length} 个`);

  // ====== 4. 演示库存（多种格式：账号密码、Cookie、Token、JSON） ======
  const demoCards = {
    'Facebook 老号': [
      'fb_aged01@demo.com|Pass123!|user_agent:Mozilla/5.0...',
      'fb_aged02@demo.com|Pass456!|2fa_secret:JBSWY3DPEHPK3PXP',
      'fb_aged03@demo.com|Pass789!|birthday:1995-03-15',
    ],
    'Facebook 新号': [
      'fb_new01@outlook.com|Newbie#2024|c_user=100012345678;xs=28:abc123;fr=1BcDeF',
      'fb_new02@outlook.com|First1!|c_user=100087654321;xs=45:def456;fr=0GhIjKl',
      'fb_new03@outlook.com|First2@|c_user=100099999999;xs=99:ghi789;fr=1MnOpQr',
      'fb_new04@outlook.com|First3#|c_user=100011111111;xs=12:jkl012;fr=0StUvWx',
    ],
    'Facebook 二解号': [
      '{"email":"fb_2fa01@demo.com","password":"SecureP1!","2fa_code":"JBSWY3DPEHPK3PXP","recovery_codes":["1111-2222","3333-4444"]}',
      '{"email":"fb_2fa02@demo.com","password":"SecureP2!","2fa_code":"KBSWY3DPEHPK3PXP","recovery_codes":["5555-6666","7777-8888"]}',
      '{"email":"fb_2fa03@demo.com","password":"SecureP3!","2fa_code":"LBSWY3DPEHPK3PXP","recovery_codes":["9999-0000","1234-5678"]}',
    ],
    'FB 广告账户（限额$50）': [
      'act_123456789|access_token:EAAxxxxx...|ad_account_status:active|daily_limit:50',
      'act_987654321|access_token:EAAyyyyy...|ad_account_status:active|daily_limit:50',
      'act_555555555|access_token:EAAzzzzz...|ad_account_status:pending|daily_limit:50',
    ],
    'FB 广告账户（不限额度）': [
      'act_unlim_001|token:EAAa1b2c3...|spend_cap:unlimited|currency:USD|timezone:PST',
      'act_unlim_002|token:EAAx9y8z7...|spend_cap:unlimited|currency:USD|timezone:EST',
    ],
    'BM 商务管理平台（基础版）': [
      'bm_id:111111|business_name:Demo_BM_01|access_token:BMA123...|ad_accounts:[act_1,act_2,act_3]',
      'bm_id:222222|business_name:Demo_BM_02|access_token:BMA456...|ad_accounts:[act_4,act_5,act_6]',
      'bm_id:333333|business_name:Demo_BM_03|access_token:BMA789...|ad_accounts:[act_7,act_8]',
    ],
    'BM 商务管理平台（企业版）': [
      'bm_id:999999|name:Enterprise_BM|verified:true|token:ENT_BM_Token_001|max_ad_accounts:unlimited|partners:[p1,p2,p3]',
      'bm_id:888888|name:Pro_BM|verified:true|token:ENT_BM_Token_002|max_ad_accounts:unlimited|partners:[p4,p5]',
    ],
    'Google Ads 账号': [
      'gads_pro1@gmail.com|oauth_refresh_token:1//abc123def456|client_id:123456789.apps.googleusercontent.com|client_secret:GOCSPX-xxxxx|developer_token:AbCdEfGhIjKlMnOp',
      'gads_pro2@gmail.com|oauth_refresh_token:1//xyz789uvw012|client_id:987654321.apps.googleusercontent.com|client_secret:GOCSPX-yyyyy|developer_token:ZxWvUtSrQpOnMlKj',
      'gads_pro3@gmail.com|oauth_refresh_token:1//ghi345jkl678|client_id:555555555.apps.googleusercontent.com|client_secret:GOCSPX-zzzzz|developer_token:HgFeDcBa987654321',
    ],
  };

  let totalCards = 0;
  for (const product of createdProducts) {
    // 按 key 前缀匹配（因为种子 key 可能不含括号后缀）
    const matchKey = Object.keys(demoCards).find(k => product.name.startsWith(k));
    const cards = matchKey ? demoCards[matchKey] : demoCards[product.name];
    if (!cards || cards.length === 0) continue;

    for (const card of cards) {
      const contentHash = hash(card);
      const exists = await prisma.inventory.findFirst({ where: { cardContentHash: contentHash } });
      if (!exists) {
        await prisma.inventory.create({
          data: {
            productId: product.id,
            cardContentEncrypted: encrypt(card),
            cardContentHash: contentHash,
            status: 'available',
          },
        });
        totalCards++;
      }
    }
  }
  console.log(`✅ 库存卡密: ${totalCards} 张`);

  // ====== 5. 支付配置 ======
  await prisma.paymentConfig.upsert({
    where: { method: 'usdt_trc20' },
    update: {},
    create: { method: 'usdt_trc20', configJson: JSON.stringify({ enabled: true }), status: 'active' },
  });
  await prisma.paymentConfig.upsert({
    where: { method: 'alipay' },
    update: {},
    create: { method: 'alipay', configJson: JSON.stringify({ enabled: false }), status: 'inactive' },
  });
  await prisma.paymentConfig.upsert({
    where: { method: 'wechat' },
    update: {},
    create: { method: 'wechat', configJson: JSON.stringify({ enabled: false }), status: 'inactive' },
  });
  console.log('✅ 支付配置: USDT 已启用\n');

  const available = await prisma.inventory.count({ where: { status: 'available' } });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 前端商店:  http://localhost:5173');
  console.log('🔐 管理后台:  http://localhost:5173/admin/login');
  console.log('👤 管理员:    admin / admin123');
  console.log(`📦 可用库存:  ${available} 张`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
