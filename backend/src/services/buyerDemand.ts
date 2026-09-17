import { Prisma } from '@prisma/client';
import { prisma } from './database.js';

export const findBuyerByUserId = (userId: string) =>
  prisma.buyer.findUnique({ where: { userId } });

export const findOwnedDemand = (buyerId: string, demandId: string) =>
  prisma.buyerDemand.findFirst({ where: { id: demandId, buyerId } });

const transitions: Record<string, string[]> = {
  DRAFT: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['PAUSED', 'FULFILLED', 'EXPIRED', 'CANCELLED'],
  PAUSED: ['ACTIVE', 'CANCELLED'],
  FULFILLED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export const isDemandTransitionAllowed = (current: string, next: string): boolean =>
  current === next || transitions[current]?.includes(next) === true;

export const decimalToNumber = (value: Prisma.Decimal | null): number | null =>
  value === null ? null : value.toNumber();
