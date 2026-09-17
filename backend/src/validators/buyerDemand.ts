import { z } from 'zod';

const coordinate = (min: number, max: number) =>
  z.number().finite().min(min).max(max).nullable().optional();

const buyerType = z.enum(['PROCESSOR', 'RETAILER', 'WHOLESALER', 'TRADER', 'EXPORTER', 'OTHER']);

export const buyerUpdateSchema = z
  .object({
    businessName: z.string().trim().min(1).max(200).optional(),
    buyerType: buyerType.optional(),
    contactName: z.string().trim().max(200).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    email: z.string().trim().email().max(320).nullable().optional(),
    address: z.string().trim().max(500).nullable().optional(),
    district: z.string().trim().max(100).nullable().optional(),
    state: z.string().trim().max(100).nullable().optional(),
    latitude: coordinate(-90, 90),
    longitude: coordinate(-180, 180),
  })
  .strict();

const demandFields = {
  cropId: z.string().cuid(),
  quantity: z.coerce.number().finite().positive(),
  quantityUnit: z.enum(['KG', 'QUINTAL', 'TON']),
  minimumQuantity: z.coerce.number().finite().positive().nullable().optional(),
  preferredMarketId: z.string().cuid().nullable().optional(),
  preferredState: z.string().trim().max(100).nullable().optional(),
  preferredDistrict: z.string().trim().max(100).nullable().optional(),
  preferredLocation: z.string().trim().max(300).nullable().optional(),
  minimumPrice: z.coerce.number().finite().nonnegative().nullable().optional(),
  maximumPrice: z.coerce.number().finite().nonnegative().nullable().optional(),
  qualityRequirement: z.string().trim().max(1000).nullable().optional(),
  validFrom: z.coerce.date().default(() => new Date()),
  validUntil: z.coerce.date().nullable().optional(),
};

const validateDemandDatesAndPrices = (
  value: {
    validFrom?: Date;
    validUntil?: Date | null;
    minimumPrice?: number | null;
    maximumPrice?: number | null;
    minimumQuantity?: number | null;
    quantity?: number;
  },
  context: z.RefinementCtx,
) => {
  if (value.validUntil && value.validFrom && value.validUntil < value.validFrom) {
    context.addIssue({ code: 'custom', path: ['validUntil'], message: 'validUntil must not precede validFrom' });
  }
  if (
    value.minimumPrice !== null &&
    value.minimumPrice !== undefined &&
    value.maximumPrice !== null &&
    value.maximumPrice !== undefined &&
    value.minimumPrice > value.maximumPrice
  ) {
    context.addIssue({ code: 'custom', path: ['minimumPrice'], message: 'minimumPrice must not exceed maximumPrice' });
  }
  if (
    value.minimumQuantity !== null &&
    value.minimumQuantity !== undefined &&
    value.quantity !== undefined &&
    value.minimumQuantity > value.quantity
  ) {
    context.addIssue({ code: 'custom', path: ['minimumQuantity'], message: 'minimumQuantity must not exceed quantity' });
  }
};

export const demandCreateSchema = z.object(demandFields).strict().superRefine(validateDemandDatesAndPrices);

export const demandUpdateSchema = z
  .object({
    ...demandFields,
    validFrom: z.coerce.date().optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'FULFILLED', 'EXPIRED', 'CANCELLED']).optional(),
  })
  .partial()
  .strict()
  .superRefine(validateDemandDatesAndPrices);

export const demandQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cropId: z.string().cuid().optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'FULFILLED', 'EXPIRED', 'CANCELLED']).optional(),
    preferredMarketId: z.string().cuid().optional(),
    state: z.string().trim().min(1).optional(),
    district: z.string().trim().min(1).optional(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
  })
  .superRefine((value, context) => {
    if (value.validFrom && value.validUntil && value.validUntil < value.validFrom) {
      context.addIssue({ code: 'custom', path: ['validUntil'], message: 'validUntil must not precede validFrom' });
    }
  });
