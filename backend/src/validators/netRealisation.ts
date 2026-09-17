import { z } from 'zod';
import { Prisma } from '@prisma/client';

const decimal = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, 'Must be a non-negative decimal value');
const percentage = decimal;

export const netRealisationSchema = z
  .object({
    lotId: z.string().cuid(),
    marketId: z.string().cuid(),
    marketPriceId: z.string().cuid(),
    saleQuantity: decimal.refine((value) => value !== '0' && !/^0(?:\.0+)?$/.test(value), 'saleQuantity must be positive'),
    saleQuantityUnit: z.enum(['KG', 'QUINTAL', 'TON']),
    transportCost: decimal.default('0'),
    storageCost: decimal.default('0'),
    commissionCost: decimal.optional(),
    commissionRate: percentage.optional(),
    packagingCost: decimal.default('0'),
    expectedLossPercentage: percentage.default('0'),
    otherCosts: decimal.default('0'),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.commissionCost !== undefined && value.commissionRate !== undefined) {
      context.addIssue({ code: 'custom', path: ['commissionCost'], message: 'Provide commissionCost or commissionRate, not both' });
    }
    if (value.expectedLossPercentage !== undefined && new Prisma.Decimal(value.expectedLossPercentage).gt(100)) {
      context.addIssue({ code: 'custom', path: ['expectedLossPercentage'], message: 'expectedLossPercentage must not exceed 100' });
    }
    if (value.commissionRate !== undefined && new Prisma.Decimal(value.commissionRate).gt(100)) {
      context.addIssue({ code: 'custom', path: ['commissionRate'], message: 'commissionRate must not exceed 100' });
    }
  });
