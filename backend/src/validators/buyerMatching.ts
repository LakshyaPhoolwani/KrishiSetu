import { z } from 'zod';

export const buyerMatchingParamsSchema = z.object({
  lotId: z.string().cuid(),
});

export const buyerMatchingQuerySchema = z.object({
  marketId: z.string().cuid().optional(),
  eligibleOnly: z.enum(['true', 'false']).transform((value) => value === 'true').default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
