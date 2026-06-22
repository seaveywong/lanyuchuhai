/**
 * 卡密服务 — 加解密 & 发卡
 * 卡密在数据库中以 AES-256-GCM 密文存储
 * 仅在支付确认后解密返回
 */
const { PrismaClient } = require('@prisma/client');
const { decrypt, hash } = require('../utils/crypto');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * 获取订单对应的卡密内容（已解密）
 * 仅在订单状态为 paid 时调用
 * @param {number} orderId
 * @returns {Promise<Array<{productName: string, cards: string[]}>>}
 */
async function getCardsByOrder(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: { select: { name: true } },
          inventory: true,
        },
      },
    },
  });

  if (!order || order.status !== 'paid') {
    return null;
  }

  const result = [];

  for (const item of order.items) {
    const cards = item.inventory.map((inv) => {
      try {
        return decrypt(inv.cardContentEncrypted);
      } catch (err) {
        logger.error('Failed to decrypt card', {
          inventoryId: inv.id,
          error: err.message,
        });
        return '[解密失败，请联系客服]';
      }
    });

    if (cards.length > 0) {
      result.push({
        productName: item.product.name,
        quantity: item.quantity,
        cards,
      });
    }
  }

  return result;
}

/**
 * 批量导入卡密（管理后台使用）
 * @param {number} productId
 * @param {string[]} cardContents - 明文卡密列表
 * @param {boolean} skipDuplicates - 是否跳过重复
 * @returns {{ imported: number, skipped: number }}
 */
async function batchImport(productId, cardContents, skipDuplicates = true) {
  let imported = 0;
  let skipped = 0;

  for (const content of cardContents) {
    const contentTrimmed = content.trim();
    if (!contentTrimmed) continue;

    const contentHash = hash(contentTrimmed);

    // 查重
    if (skipDuplicates) {
      const exists = await prisma.inventory.findFirst({
        where: { cardContentHash: contentHash },
      });
      if (exists) {
        skipped++;
        continue;
      }
    }

    // 加密存储
    const { encrypt } = require('../utils/crypto');
    const encrypted = encrypt(contentTrimmed);

    await prisma.inventory.create({
      data: {
        productId,
        cardContentEncrypted: encrypted,
        cardContentHash: contentHash,
        status: 'available',
      },
    });

    imported++;
  }

  return { imported, skipped };
}

module.exports = { getCardsByOrder, batchImport };
