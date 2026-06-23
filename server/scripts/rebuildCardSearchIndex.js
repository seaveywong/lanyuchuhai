require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('../src/utils/crypto');
const { buildCardSearchIndex } = require('../src/services/card');

const prisma = new PrismaClient();

async function main() {
  let cursor = 0;
  let updated = 0;
  for (;;) {
    const batch = await prisma.inventory.findMany({
      where: { id: { gt: cursor } },
      orderBy: { id: 'asc' },
      take: 200,
      select: { id: true, cardContentEncrypted: true },
    });
    if (!batch.length) break;
    await prisma.$transaction(batch.map((item) => prisma.inventory.update({
      where: { id: item.id },
      data: { cardSearchIndex: buildCardSearchIndex(decrypt(item.cardContentEncrypted)) },
    })));
    updated += batch.length;
    cursor = batch[batch.length - 1].id;
  }
  process.stdout.write('Rebuilt card search index for ' + updated + ' inventory rows\n');
}

main().catch((err) => {
  process.stderr.write(err.stack + '\n');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
