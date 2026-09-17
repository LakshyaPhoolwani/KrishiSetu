import { z } from 'zod';

const coordinate = z.number().finite();
const date = z.coerce.date();

export const farmerUpdateSchema = z
  .object({
    preferredLanguage: z.string().trim().min(1).max(50).nullable().optional(),
    district: z.string().trim().min(1).max(100).nullable().optional(),
    state: z.string().trim().min(1).max(100).nullable().optional(),
    latitude: coordinate.min(-90).max(90).nullable().optional(),
    longitude: coordinate.min(-180).max(180).nullable().optional(),
  })
  .strict();

const locationFields = {
  name: z.string().trim().min(1).max(150),
  address: z.string().trim().max(300).nullable().optional(),
  village: z.string().trim().max(100).nullable().optional(),
  district: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().max(100).nullable().optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, 'Pincode must contain exactly 6 digits')
    .nullable()
    .optional(),
  latitude: coordinate.min(-90).max(90).nullable().optional(),
  longitude: coordinate.min(-180).max(180).nullable().optional(),
  area: z.number().positive(),
  areaUnit: z.enum(['ACRE', 'HECTARE']),
};

export const farmCreateSchema = z.object(locationFields).strict();
export const farmUpdateSchema = farmCreateSchema.partial().strict();

const lotFields = {
  farmId: z.string().cuid(),
  cropId: z.string().cuid(),
  quantity: z.number().positive(),
  quantityUnit: z.enum(['KG', 'QUINTAL', 'TON']),
  sowingDate: date.nullable().optional(),
  expectedHarvestDate: date.nullable().optional(),
  actualHarvestDate: date.nullable().optional(),
  cultivationArea: z.number().positive().nullable().optional(),
  cultivationAreaUnit: z.enum(['ACRE', 'HECTARE']).nullable().optional(),
  qualityGrade: z.string().trim().max(50).nullable().optional(),
  qualityNotes: z.string().trim().max(1000).nullable().optional(),
};

export const lotCreateSchema = z
  .object(lotFields)
  .strict()
  .superRefine(validateLotDates);

export const lotUpdateSchema = z
  .object(lotFields)
  .omit({ farmId: true, cropId: true })
  .partial()
  .extend({
    status: z.enum(['DRAFT', 'READY_FOR_MARKET']).optional(),
  })
  .strict()
  .superRefine(validateLotDates);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const lotFilterSchema = paginationSchema.extend({
  status: z
    .enum([
      'DRAFT',
      'READY_FOR_MARKET',
      'LISTED',
      'MATCHED',
      'SOLD',
      'IN_TRANSIT',
      'DELIVERED',
      'CANCELLED',
    ])
    .optional(),
  cropId: z.string().cuid().optional(),
  farmId: z.string().cuid().optional(),
});

function validateLotDates(
  value: {
    sowingDate?: Date | null;
    expectedHarvestDate?: Date | null;
    actualHarvestDate?: Date | null;
  },
  context: z.RefinementCtx,
): void {
  if (value.sowingDate && value.expectedHarvestDate && value.sowingDate > value.expectedHarvestDate) {
    context.addIssue({
      code: 'custom',
      path: ['expectedHarvestDate'],
      message: 'Expected harvest date must be on or after sowing date',
    });
  }
  if (value.sowingDate && value.actualHarvestDate && value.actualHarvestDate < value.sowingDate) {
    context.addIssue({
      code: 'custom',
      path: ['actualHarvestDate'],
      message: 'Actual harvest date must be on or after sowing date',
    });
  }
}
