import type { Request, Response } from 'express';
import { prisma } from '../services/database.js';
import { findBuyerByUserId } from '../services/buyerDemand.js';
import { buyerUpdateSchema } from '../validators/buyerDemand.js';
import type { AuthenticatedRequest } from '../types/auth.js';

const authContext = (request: Request) => (request as AuthenticatedRequest).authContext;

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

export const getBuyerProfile = async (request: Request, response: Response): Promise<void> => {
  const buyer = await buyerOrNotFound(request, response);
  if (!buyer) return;
  response.json({ success: true, data: { buyer } });
};

export const updateBuyerProfile = async (request: Request, response: Response): Promise<void> => {
  const buyer = await buyerOrNotFound(request, response);
  if (!buyer) return;
  const parsed = buyerUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, error: { code: 'INVALID_BUYER', message: 'Buyer fields are invalid' } });
    return;
  }
  const updated = await prisma.buyer.update({ where: { id: buyer.id }, data: parsed.data });
  response.json({ success: true, data: { buyer: updated } });
};
