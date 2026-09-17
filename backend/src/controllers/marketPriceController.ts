import type { Request, Response } from 'express';
import { prisma } from '../services/database.js';
import { marketPriceFilterSchema } from '../validators/marketData.js';
import { z } from 'zod';

const serialize = (value: unknown): unknown => {
  if (value && typeof value === 'object' && 'toString' in value && value.constructor.name === 'Decimal') {
    return value.toString();
  }
  return value;
};

const serializePrice = (price: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(price).map(([key, value]) => [key, serialize(value)]));

export const listMarketPrices = async (request: Request, response: Response): Promise<void> => {
  const parsed = marketPriceFilterSchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ success: false, error: { code: 'INVALID_PRICE_FILTER', message: 'Market price filters are invalid' } });
    return;
  }
  const { page, limit, marketId, cropId, fromDate, toDate, source, sourceType } = parsed.data;
  const where = {
    ...(marketId ? { marketId } : {}),
    ...(cropId ? { cropId } : {}),
    ...(source ? { source } : {}),
    ...(sourceType ? { sourceType } : {}),
    ...(fromDate || toDate ? { priceDate: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {}),
  };
  const [prices, total] = await prisma.$transaction([
    prisma.marketPrice.findMany({ where, include: { market: true, crop: true }, orderBy: [{ priceDate: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
    prisma.marketPrice.count({ where }),
  ]);
  response.json({ success: true, data: prices.map((price) => serializePrice(price as unknown as Record<string, unknown>)), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
};

export const getMarketPrice = async (request: Request, response: Response): Promise<void> => {
  const priceId = z.string().cuid().safeParse(request.params.id);
  if (!priceId.success) {
    response.status(400).json({ success: false, error: { code: 'INVALID_MARKET_PRICE_ID', message: 'Market price ID is invalid' } });
    return;
  }
  const price = await prisma.marketPrice.findUnique({ where: { id: priceId.data }, include: { market: true, crop: true } });
  if (!price) {
    response.status(404).json({ success: false, error: { code: 'MARKET_PRICE_NOT_FOUND', message: 'Market price not found' } });
    return;
  }
  response.json({ success: true, data: { price: serializePrice(price as unknown as Record<string, unknown>) } });
};
