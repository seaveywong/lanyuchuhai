const { PrismaClient } = require('@prisma/client');
const { encrypt, decrypt, hash, hmac } = require('../utils/crypto');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

function normalizeForSearch(content) {
  return Array.from(String(content || '').normalize('NFKC').toLowerCase()).filter((char) => !/\s/.test(char)).join('');
}

function searchTokens(content) {
  const value = normalizeForSearch(content);
  if (value.length < 3) return [];
  const tokens = new Set();
  for (let index = 0; index <= value.length - 3 && tokens.size < 120; index += 1) tokens.add(hmac(value.slice(index, index + 3)));
  return [...tokens];
}

function buildCardSearchIndex(content) {
  const tokens = searchTokens(content);
  return tokens.length ? '|' + tokens.join('|') + '|' : null;
}

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

  if (!order || order.status !== 'paid') return null;

  const result = [];
  for (const item of order.items) {
    const cards = item.inventory.map((inv) => {
      try {
        return decrypt(inv.cardContentEncrypted);
      } catch (err) {
        logger.error('Failed to decrypt card', { inventoryId: inv.id, error: err.message });
        return '[解密失败，请联系客服]';
      }
    });

    if (cards.length > 0) {
      result.push({ productName: item.product.name, quantity: item.quantity, cards });
    }
  }

  return result;
}

async function batchImport(productId, cardContents, skipDuplicates = true) {
  let imported = 0;
  let skipped = 0;

  for (const content of cardContents) {
    const contentTrimmed = String(content || '').trim();
    if (!contentTrimmed) continue;

    const contentHash = hash(contentTrimmed);
    if (skipDuplicates) {
      const exists = await prisma.inventory.findFirst({ where: { cardContentHash: contentHash } });
      if (exists) {
        skipped++;
        continue;
      }
    }

    await prisma.inventory.create({
      data: {
        productId,
        cardContentEncrypted: encrypt(contentTrimmed),
        cardContentHash: contentHash,
        cardSearchIndex: buildCardSearchIndex(contentTrimmed),
        status: 'available',
      },
    });
    imported++;
  }

  return { imported, skipped };
}

async function buildEncryptedCardData(content, inventoryId = null) {
  const contentTrimmed = String(content || '').trim();
  if (!contentTrimmed) throw new Error('卡密内容不能为空');

  const contentHash = hash(contentTrimmed);
  const duplicate = await prisma.inventory.findFirst({
    where: {
      cardContentHash: contentHash,
      ...(inventoryId ? { id: { not: inventoryId } } : {}),
    },
  });
  if (duplicate) throw new Error('卡密内容重复，已存在于库存中');

  return {
    cardContentEncrypted: encrypt(contentTrimmed),
    cardContentHash: contentHash,
    cardSearchIndex: buildCardSearchIndex(contentTrimmed),
  };
}

module.exports = { getCardsByOrder, batchImport, buildEncryptedCardData, buildCardSearchIndex, searchTokens };
