import type { Request, Response } from 'express';
import { prisma } from '../services/database.js';
import { evaluateBuyerDemandMatch } from '../services/buyerMatching.js';
import { buyerMatchingParamsSchema, buyerMatchingQuerySchema } from '../validators/buyerMatching.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export const listBuyerMatches = async (request: Request, response: Response): Promise<void> => {
  const params = buyerMatchingParamsSchema.safeParse(request.params);
  const query = buyerMatchingQuerySchema.safeParse(request.query);
  if (!params.success || !query.success) {
    response.status(400).json({ success: false, error: { code: 'INVALID_MATCHING_REQUEST', message: 'Matching request is invalid' } });
    return;
  }
  const context = (request as AuthenticatedRequest).authContext;
  if (!context) {
    response.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }
  const farmer = await prisma.farmer.findUnique({ where: { userId: context.databaseUserId }, select: { id: true } });
  if (!farmer) {
    response.status(404).json({ success: false, error: { code: 'FARMER_NOT_FOUND', message: 'Farmer profile not found' } });
    return;
  }
  const lot = await prisma.lot.findFirst({
    where: { id: params.data.lotId, farmerId: farmer.id },
    include: { farm: { select: { state: true, district: true } } },
  });
  if (!lot) {
    response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not own this lot' } });
    return;
  }
  const demands = await prisma.buyerDemand.findMany({
    where: { cropId: lot.cropId },
    include: { buyer: { select: { id: true, businessName: true, buyerType: true, status: true } } },
    orderBy: [{ buyerId: 'asc' }, { id: 'asc' }],
  });
  const marketPrice = query.data.marketId
    ? await prisma.marketPrice.findFirst({
        where: { marketId: query.data.marketId, cropId: lot.cropId },
        orderBy: [{ priceDate: 'desc' }, { id: 'desc' }],
        select: { marketId: true, cropId: true, modalPrice: true, normalizedUnit: true, priceDate: true, source: true, sourceType: true },
      })
    : undefined;
  const results = demands
    .map((demand) => evaluateBuyerDemandMatch(lot, demand, new Date(), marketPrice ?? undefined))
    .filter((result) => !query.data.eligibleOnly || result.eligible);
  const start = (query.data.page - 1) * query.data.limit;
  const data = results.slice(start, start + query.data.limit);
  response.json({
    success: true,
    data,
    pagination: { page: query.data.page, limit: query.data.limit, total: results.length, totalPages: Math.ceil(results.length / query.data.limit) },
  });
};
