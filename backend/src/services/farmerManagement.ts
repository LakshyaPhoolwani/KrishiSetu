import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from './database.js';

export const findFarmerByUserId = (userId: string) =>
  prisma.farmer.findUnique({ where: { userId } });

export const findOwnedFarm = (farmerId: string, farmId: string) =>
  prisma.farm.findFirst({ where: { id: farmId, farmerId } });

export const findOwnedLot = (farmerId: string, lotId: string) =>
  prisma.lot.findFirst({ where: { id: lotId, farmerId } });

export const createLotCode = async (): Promise<string> => {
  const year = new Date().getUTCFullYear();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `LOT-${year}-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const exists = await prisma.lot.findUnique({ where: { lotCode: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  throw new Error('Unable to generate a unique lot code');
};

export const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
