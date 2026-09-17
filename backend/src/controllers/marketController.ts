import type { Request, Response } from 'express';
import { prisma } from '../services/database.js';
import { marketFilterSchema } from '../validators/marketData.js';
import { z } from 'zod';

export const listMarkets = async (request: Request, response: Response): Promise<void> => {
  const parsed = marketFilterSchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ success: false, error: { code: 'INVALID_MARKET_FILTER', message: 'Market filters are invalid' } });
    return;
  }
  const { page, limit, state, district, active, cropId } = parsed.data;
  const where = {
    ...(state ? { state } : {}),
    ...(district ? { district } : {}),
    ...(active === undefined ? {} : { active }),
    ...(cropId ? { prices: { some: { cropId } } } : {}),
  };
  const [markets, total] = await prisma.$transaction([
    prisma.market.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * limit, take: limit }),
    prisma.market.count({ where }),
  ]);
  response.json({ success: true, data: markets, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
};

export const getMarket = async (request: Request, response: Response): Promise<void> => {
  const marketId = z.string().cuid().safeParse(request.params.id);
  if (!marketId.success) {
    response.status(400).json({ success: false, error: { code: 'INVALID_MARKET_ID', message: 'Market ID is invalid' } });
    return;
  }
  const market = await prisma.market.findUnique({ where: { id: marketId.data } });
  if (!market) {
    response.status(404).json({ success: false, error: { code: 'MARKET_NOT_FOUND', message: 'Market not found' } });
    return;
  }
  response.json({ success: true, data: { market } });
};
