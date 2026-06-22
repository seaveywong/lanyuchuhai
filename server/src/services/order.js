const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const config = require('../config');

const prisma = new PrismaClient();

function generateOrderNo() {
  const now = new Date();
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const random = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `VT${date}${random}`;
}

async function createOrder(email, accessPin, paymentMethod, items) {
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, status: 'active' },
    include: {
      _count: { select: { inventory: { where: { status: 'available' } } } },
    },
  });

  if (products.length !== productIds.length) {
    const missing = productIds.filter((id) => !products.find((p) => p.id === id));
    throw new AppError(`商品不存在或已下架: ${missing.join(', ')}`, 400);
  }

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (product._count.inventory < item.quantity) {
      throw new AppError(`「${product.name}」库存不足，当前剩余 ${product._count.inventory} 件，请刷新页面`, 400);
    }
  }

  let totalAmount = 0;
  const orderItems = [];
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    const unitPrice = parseFloat(product.price);
    totalAmount += unitPrice * item.quantity;
    orderItems.push({ product, quantity: item.quantity, unitPrice });
  }

  const accessPinHash = await bcrypt.hash(accessPin, config.orderAccessPin.rounds);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNo: generateOrderNo(),
        email: email.toLowerCase().trim(),
        accessPin: accessPinHash,
        totalAmount,
        currency: 'CNY',
        status: 'pending',
        paymentMethod: paymentMethod || 'usdt_trc20',
      },
    });

    for (const oi of orderItems) {
      await tx.orderItem.create({
        data: {
          orderId: created.id,
          productId: oi.product.id,
          quantity: oi.quantity,
          unitPrice: oi.unitPrice,
        },
      });
    }

    return created;
  });

  return prisma.order.findUnique({
    where: { id: order.id },
    include: {
      items: { include: { product: { select: { name: true } } } },
    },
  });
}

async function confirmPayment(orderId, method, paymentRef) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });

  if (!order) throw new AppError('订单不存在', 404);
  if (order.status === 'paid') return;

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      const availableCards = await tx.inventory.findMany({
        where: { productId: item.productId, status: 'available' },
        take: item.quantity,
        orderBy: { createdAt: 'asc' },
      });

      if (availableCards.length < item.quantity) {
        logger.warn('Partial stock fulfillment', {
          orderId,
          productId: item.productId,
          needed: item.quantity,
          got: availableCards.length,
        });
      }

      if (availableCards.length > 0) {
        await tx.inventory.updateMany({
          where: { id: { in: availableCards.map((c) => c.id) } },
          data: { status: 'sold', orderItemId: item.id, soldAt: new Date() },
        });
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'paid',
        paymentMethod: method,
        paymentRef,
        paidAt: new Date(),
      },
    });
  });

  logger.info('Payment confirmed', { orderId, orderNo: order.orderNo, method });
}

async function cancelOrder(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== 'pending') return;
  await prisma.order.update({ where: { id: orderId }, data: { status: 'cancelled' } });
  logger.info('Order cancelled', { orderId, orderNo: order.orderNo });
}

module.exports = { createOrder, confirmPayment, cancelOrder };
