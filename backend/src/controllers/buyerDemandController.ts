import type { Request, Response } from 'express';
import { prisma } from '../services/database.js';
import {
  findBuyerByUserId,
  findOwnedDemand,
  isDemandTransitionAllowed,
} from '../services/buyerDemand.js';
import {
  demandCreateSchema,
  demandQuerySchema,
  demandUpdateSchema,
} from '../validators/buyerDemand.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { routeParam } from '../utils/request.js';

const authContext = (request: Request) => (request as AuthenticatedRequest).authContext;
const forbidden = (response: Response) =>
  response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not own this demand' } });

const buyerOrNotFound = async (request: Request, response: Response) => {
  const context = authContext(request);
  if (!context) return undefined;
  const buyer = await findBuyerByUserId(context.databaseUserId);
  if (!buyer) {
    response.status(404).json({ success: false, error: { code: 'BUYER_NOT_FOUND', message: 'Buyer profile not found' } });
    return undefined;
  }
  return buyer;
};

const serializeDemand = (demand: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(demand).map(([key, value]) => [
      key,
      value && typeof value === 'object' && 'toNumber' in value ? (value as { toNumber: () => number }).toNumber() : value,
    ]),
  );

export const createBuyerDemand = async (request: Request, response: Response): Promise<void> => {
  const buyer = await buyerOrNotFound(request, response);
  if (!buyer) return;
  const parsed = demandCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, error: { code: 'INVALID_BUYER_DEMAND', message: 'Buyer demand fields are invalid' } });
    return;
  }
  const demand = await prisma.buyerDemand.create({
    data: { ...parsed.data, buyerId: buyer.id, status: 'DRAFT' },
    include: { crop: true, preferredMarket: true },
  });
  response.status(201).json({ success: true, data: { demand: serializeDemand(demand as unknown as Record<string, unknown>) } });
};

export const listBuyerDemands = async (request: Request, response: Response): Promise<void> => {
  const buyer = await buyerOrNotFound(request, response);
  if (!buyer) return;
  const parsed = demandQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ success: false, error: { code: 'INVALID_BUYER_DEMAND_FILTER', message: 'Buyer demand filters are invalid' } });
    return;
  }
  const { page, limit, cropId, status, preferredMarketId, state, district, validFrom, validUntil } = parsed.data;
  const where = {
    buyerId: buyer.id,
    ...(cropId ? { cropId } : {}),
    ...(status ? { status } : {}),
    ...(preferredMarketId ? { preferredMarketId } : {}),
    ...(state ? { preferredState: state } : {}),
    ...(district ? { preferredDistrict: district } : {}),
    ...(validFrom || validUntil ? { validFrom: { ...(validFrom ? { gte: validFrom } : {}), ...(validUntil ? { lte: validUntil } : {}) } } : {}),
  };
  const [demands, total] = await prisma.$transaction([
    prisma.buyerDemand.findMany({ where, include: { crop: true, preferredMarket: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.buyerDemand.count({ where }),
  ]);
  response.json({ success: true, data: demands.map((demand) => serializeDemand(demand as unknown as Record<string, unknown>)), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
};

export const getBuyerDemand = async (request: Request, response: Response): Promise<void> => {
  const buyer = await buyerOrNotFound(request, response);
  if (!buyer) return;
  const demand = await findOwnedDemand(buyer.id, routeParam(request.params.id) ?? '');
  if (!demand) {
    forbidden(response);
    return;
  }
  response.json({ success: true, data: { demand: serializeDemand(demand as unknown as Record<string, unknown>) } });
};

export const updateBuyerDemand = async (request: Request, response: Response): Promise<void> => {
  const buyer = await buyerOrNotFound(request, response);
  if (!buyer) return;
  const demand = await findOwnedDemand(buyer.id, routeParam(request.params.id) ?? '');
  if (!demand) {
    forbidden(response);
    return;
  }
  const parsed = demandUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, error: { code: 'INVALID_BUYER_DEMAND', message: 'Buyer demand fields are invalid' } });
    return;
  }
  if (parsed.data.status && !isDemandTransitionAllowed(demand.status, parsed.data.status)) {
    response.status(400).json({ success: false, error: { code: 'INVALID_DEMAND_TRANSITION', message: 'Demand status transition is not allowed' } });
    return;
  }
  const updated = await prisma.buyerDemand.update({ where: { id: demand.id }, data: parsed.data, include: { crop: true, preferredMarket: true } });
  response.json({ success: true, data: { demand: serializeDemand(updated as unknown as Record<string, unknown>) } });
};

export const cancelBuyerDemand = async (request: Request, response: Response): Promise<void> => {
  const buyer = await buyerOrNotFound(request, response);
  if (!buyer) return;
  const demand = await findOwnedDemand(buyer.id, routeParam(request.params.id) ?? '');
  if (!demand) {
    forbidden(response);
    return;
  }
  if (!isDemandTransitionAllowed(demand.status, 'CANCELLED')) {
    response.status(400).json({ success: false, error: { code: 'INVALID_DEMAND_TRANSITION', message: 'Demand cannot be cancelled' } });
    return;
  }
  await prisma.buyerDemand.update({ where: { id: demand.id }, data: { status: 'CANCELLED' } });
  response.status(204).send();
};
