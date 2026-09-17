import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../services/database.js';
import { calculateNetRealisation, decimalStrings, quantityToQuintals } from '../services/netRealisation.js';
import { netRealisationSchema } from '../validators/netRealisation.js';
import type { AuthenticatedRequest } from '../types/auth.js';

const authContext = (request: Request) => (request as AuthenticatedRequest).authContext;

export const calculateNetRealisationForLot = async (request: Request, response: Response): Promise<void> => {
  const parsed = netRealisationSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, error: { code: 'INVALID_NET_REALISATION', message: 'Calculation inputs are invalid' } });
    return;
  }
  const context = authContext(request);
  if (!context) {
    response.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }
  const farmer = await prisma.farmer.findUnique({ where: { userId: context.databaseUserId }, select: { id: true } });
  if (!farmer) {
    response.status(404).json({ success: false, error: { code: 'FARMER_NOT_FOUND', message: 'Farmer profile not found' } });
    return;
  }
  const lot = await prisma.lot.findFirst({ where: { id: parsed.data.lotId, farmerId: farmer.id }, select: { id: true, cropId: true, quantity: true, quantityUnit: true } });
  if (!lot) {
    response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not own this lot' } });
    return;
  }
  if (quantityToQuintals(new Prisma.Decimal(parsed.data.saleQuantity), parsed.data.saleQuantityUnit)
    .gt(quantityToQuintals(lot.quantity, lot.quantityUnit))) {
    response.status(400).json({ success: false, error: { code: 'INVALID_SALE_QUANTITY', message: 'Sale quantity exceeds lot quantity' } });
    return;
  }
  const marketPrice = await prisma.marketPrice.findUnique({
    where: { id: parsed.data.marketPriceId },
    select: { id: true, marketId: true, cropId: true, modalPrice: true, normalizedUnit: true, priceDate: true, source: true, sourceType: true },
  });
  if (!marketPrice || marketPrice.marketId !== parsed.data.marketId) {
    response.status(400).json({ success: false, error: { code: 'INVALID_MARKET_PRICE', message: 'Market price does not belong to the requested market' } });
    return;
  }
  if (marketPrice.cropId !== lot.cropId || marketPrice.modalPrice === null || marketPrice.normalizedUnit !== 'INR_PER_QUINTAL') {
    response.status(400).json({ success: false, error: { code: 'INVALID_MARKET_PRICE', message: 'Market price is not valid for this lot' } });
    return;
  }
  const result = calculateNetRealisation({
    ...parsed.data,
    salePricePerQuintal: marketPrice.modalPrice.toString(),
  });
  const calculation = await prisma.netRealisationCalculation.create({
    data: {
      lotId: lot.id,
      marketId: parsed.data.marketId,
      marketPriceId: marketPrice.id,
      ...result,
    },
  });
  response.status(201).json({
    success: true,
    data: {
      calculation: {
        ...decimalStrings(result),
        id: calculation.id,
        lotId: calculation.lotId,
        marketId: calculation.marketId,
        marketPriceId: calculation.marketPriceId,
        priceDate: marketPrice.priceDate,
        source: marketPrice.source,
        sourceType: marketPrice.sourceType,
        calculatedAt: calculation.createdAt,
      },
    },
  });
};
