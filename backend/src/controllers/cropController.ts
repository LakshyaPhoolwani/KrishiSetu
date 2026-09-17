import type { Request, Response } from 'express';
import { prisma } from '../services/database.js';
import { routeParam } from '../utils/request.js';

export const listCrops = async (_request: Request, response: Response): Promise<void> => {
  const crops = await prisma.crop.findMany({ orderBy: [{ name: 'asc' }, { variety: 'asc' }] });
  response.json({ success: true, data: crops });
};

export const getCrop = async (request: Request, response: Response): Promise<void> => {
  const id = routeParam(request.params.id);
  const crop = id ? await prisma.crop.findUnique({ where: { id } }) : null;
  if (!crop) {
    response.status(404).json({ success: false, error: { code: 'CROP_NOT_FOUND', message: 'Crop not found' } });
    return;
  }
  response.json({ success: true, data: { crop } });
};
