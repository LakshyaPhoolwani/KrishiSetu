import type { Request, Response } from 'express';
import { prisma } from '../services/database.js';
import { findFarmerByUserId, findOwnedFarm } from '../services/farmerManagement.js';
import { farmCreateSchema, farmUpdateSchema } from '../validators/farmerManagement.js';
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

export const createFarm = async (request: Request, response: Response): Promise<void> => {
  const farmer = await requireFarmer(request, response);
  if (!farmer) return;
  const parsed = farmCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, error: { code: 'INVALID_FARM', message: 'Farm fields are invalid' } });
    return;
  }
  const farm = await prisma.farm.create({ data: { ...parsed.data, farmerId: farmer.id } });
  response.status(201).json({ success: true, data: { farm } });
};

export const listFarms = async (request: Request, response: Response): Promise<void> => {
  const farmer = await requireFarmer(request, response);
  if (!farmer) return;
  const page = Number(request.query.page ?? 1);
  const limit = Math.min(Number(request.query.limit ?? 20), 100);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1) {
    response.status(400).json({ success: false, error: { code: 'INVALID_PAGINATION', message: 'Pagination values are invalid' } });
    return;
  }
  const [farms, total] = await prisma.$transaction([
    prisma.farm.findMany({ where: { farmerId: farmer.id }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.farm.count({ where: { farmerId: farmer.id } }),
  ]);
  response.json({ success: true, data: farms, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
};

export const getFarm = async (request: Request, response: Response): Promise<void> => {
  const farmer = await requireFarmer(request, response);
  if (!farmer) return;
  const farm = await findOwnedFarm(farmer.id, routeParam(request.params.id) ?? '');
  if (!farm) {
    forbidden(response);
    return;
  }
  response.json({ success: true, data: { farm } });
};

export const updateFarm = async (request: Request, response: Response): Promise<void> => {
  const farmer = await requireFarmer(request, response);
  if (!farmer) return;
  const farm = await findOwnedFarm(farmer.id, routeParam(request.params.id) ?? '');
  if (!farm) {
    forbidden(response);
    return;
  }
  const parsed = farmUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, error: { code: 'INVALID_FARM', message: 'Farm fields are invalid' } });
    return;
  }
  const updated = await prisma.farm.update({ where: { id: farm.id }, data: parsed.data });
  response.json({ success: true, data: { farm: updated } });
};

export const deleteFarm = async (request: Request, response: Response): Promise<void> => {
  const farmer = await requireFarmer(request, response);
  if (!farmer) return;
  const farm = await findOwnedFarm(farmer.id, routeParam(request.params.id) ?? '');
  if (!farm) {
    forbidden(response);
    return;
  }
  const lotCount = await prisma.lot.count({ where: { farmId: farm.id } });
  if (lotCount > 0) {
    response.status(409).json({ success: false, error: { code: 'FARM_HAS_LOTS', message: 'Farm cannot be deleted while it has lots' } });
    return;
  }
  await prisma.farm.delete({ where: { id: farm.id } });
  response.status(204).send();
};
