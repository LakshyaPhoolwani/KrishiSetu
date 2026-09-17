import type { Request, Response } from 'express';
import { prisma } from '../services/database.js';
import { findFarmerByUserId } from '../services/farmerManagement.js';
import { farmerUpdateSchema } from '../validators/farmerManagement.js';
import type { AuthenticatedRequest } from '../types/auth.js';

const context = (request: Request) => (request as AuthenticatedRequest).authContext;

export const getFarmerProfile = async (request: Request, response: Response): Promise<void> => {
  const auth = context(request);
  if (!auth) return;
  const farmer = await prisma.farmer.findUnique({
    where: { userId: auth.databaseUserId },
    include: { fpo: true },
  });
  if (!farmer) {
    response.status(404).json({ success: false, error: { code: 'FARMER_NOT_FOUND', message: 'Farmer profile not found' } });
    return;
  }
  response.json({ success: true, data: { farmer } });
};

export const updateFarmerProfile = async (request: Request, response: Response): Promise<void> => {
  const auth = context(request);
  if (!auth) return;
  const parsed = farmerUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, error: { code: 'INVALID_FARMER', message: 'Farmer profile fields are invalid' } });
    return;
  }
  const farmer = await findFarmerByUserId(auth.databaseUserId);
  if (!farmer) {
    response.status(404).json({ success: false, error: { code: 'FARMER_NOT_FOUND', message: 'Farmer profile not found' } });
    return;
  }
  const updated = await prisma.farmer.update({ where: { id: farmer.id }, data: parsed.data });
  response.json({ success: true, data: { farmer: updated } });
};
