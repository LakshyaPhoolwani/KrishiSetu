import type { Request, Response } from 'express';
import { prisma } from '../services/database.js';
import { createLotCode, findFarmerByUserId, findOwnedLot } from '../services/farmerManagement.js';
import { lotCreateSchema, lotFilterSchema, lotUpdateSchema } from '../validators/farmerManagement.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { routeParam } from '../utils/request.js';

const authContext = (request: Request) => (request as AuthenticatedRequest).authContext;
const forbidden = (response: Response) =>
  response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not own this resource' } });

const requireFarmer = async (request: Request, response: Response) => {
  const auth = authContext(request);
  if (!auth) return undefined;
  const farmer = await findFarmerByUserId(auth.databaseUserId);
  if (!farmer) {
    response.status(404).json({ success: false, error: { code: 'FARMER_NOT_FOUND', message: 'Farmer profile not found' } });
    return undefined;
  }
  return farmer;
};

export const createLot = async (request: Request, response: Response): Promise<void> => {
  const farmer = await requireFarmer(request, response);
  if (!farmer) return;
  const parsed = lotCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, error: { code: 'INVALID_LOT', message: 'Lot fields are invalid' } });
    return;
  }
  const farm = await prisma.farm.findFirst({ where: { id: parsed.data.farmId, farmerId: farmer.id } });
  if (!farm) {
    forbidden(response);
    return;
  }
  const crop = await prisma.crop.findUnique({ where: { id: parsed.data.cropId } });
  if (!crop) {
    response.status(404).json({ success: false, error: { code: 'CROP_NOT_FOUND', message: 'Crop not found' } });
    return;
  }
  const lot = await prisma.lot.create({
    data: { ...parsed.data, lotCode: await createLotCode(), farmerId: farmer.id },
    include: { farm: true, crop: true },
  });
  response.status(201).json({ success: true, data: { lot } });
};

export const listLots = async (request: Request, response: Response): Promise<void> => {
  const farmer = await requireFarmer(request, response);
  if (!farmer) return;
  const parsed = lotFilterSchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ success: false, error: { code: 'INVALID_PAGINATION', message: 'Lot filters are invalid' } });
    return;
  }
  const { page, limit, status, cropId, farmId } = parsed.data;
  const where = { farmerId: farmer.id, ...(status ? { status } : {}), ...(cropId ? { cropId } : {}), ...(farmId ? { farmId } : {}) };
  const [lots, total] = await prisma.$transaction([
    prisma.lot.findMany({ where, include: { farm: true, crop: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.lot.count({ where }),
  ]);
  response.json({ success: true, data: lots, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
};

export const getLot = async (request: Request, response: Response): Promise<void> => {
  const farmer = await requireFarmer(request, response);
  if (!farmer) return;
  const lot = await findOwnedLot(farmer.id, routeParam(request.params.id) ?? '');
  if (!lot) {
    forbidden(response);
    return;
  }
  response.json({ success: true, data: { lot } });
};

export const updateLot = async (request: Request, response: Response): Promise<void> => {
  const farmer = await requireFarmer(request, response);
  if (!farmer) return;
  const lot = await findOwnedLot(farmer.id, routeParam(request.params.id) ?? '');
  if (!lot) {
    forbidden(response);
    return;
  }
  const parsed = lotUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, error: { code: 'INVALID_LOT', message: 'Lot fields are invalid' } });
    return;
  }
  if (lot.status !== 'DRAFT' && parsed.data.status === 'DRAFT') {
    response.status(409).json({ success: false, error: { code: 'INVALID_STATUS_TRANSITION', message: 'Lot status cannot move back to DRAFT' } });
    return;
  }
  const updated = await prisma.lot.update({ where: { id: lot.id }, data: parsed.data });
  response.json({ success: true, data: { lot: updated } });
};

export const deleteLot = async (request: Request, response: Response): Promise<void> => {
  const farmer = await requireFarmer(request, response);
  if (!farmer) return;
  const lot = await findOwnedLot(farmer.id, routeParam(request.params.id) ?? '');
  if (!lot) {
    forbidden(response);
    return;
  }
  await prisma.lot.delete({ where: { id: lot.id } });
  response.status(204).send();
};
