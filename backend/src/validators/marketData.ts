import { z } from 'zod';

export const marketFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  state: z.string().trim().min(1).optional(),
  district: z.string().trim().min(1).optional(),
  active: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  cropId: z.string().cuid().optional(),
});

export const marketPriceFilterSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    marketId: z.string().cuid().optional(),
    cropId: z.string().cuid().optional(),
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
    source: z.string().trim().min(1).optional(),
    sourceType: z.enum(['LIVE', 'DEMO']).optional(),
  })
  .superRefine((value, context) => {
    if (value.fromDate && value.toDate && value.fromDate > value.toDate) {
      context.addIssue({
        code: 'custom',
        path: ['fromDate'],
        message: 'fromDate must be on or before toDate',
      });
    }
  });

export const providerRecordSchema = z
  .object({
    sourceRecordId: z.string().trim().min(1).max(200),
    marketId: z.string().cuid(),
    cropId: z.string().cuid(),
    priceDate: z.coerce.date(),
    minPrice: z.number().nonnegative().nullable().optional(),
    maxPrice: z.number().nonnegative().nullable().optional(),
    modalPrice: z.number().nonnegative().nullable().optional(),
    sourceUnit: z.enum(['KG', 'QUINTAL']),
    source: z.string().trim().min(1).max(100),
    sourceType: z.enum(['LIVE', 'DEMO']),
  })
  .superRefine((value, context) => {
    const prices = [value.minPrice, value.modalPrice, value.maxPrice];
    if (prices.every((price) => price === null || price === undefined)) {
      context.addIssue({ code: 'custom', path: ['modalPrice'], message: 'At least one price is required' });
    }
    if (
      value.minPrice !== null &&
      value.minPrice !== undefined &&
      value.modalPrice !== null &&
      value.modalPrice !== undefined &&
      value.minPrice > value.modalPrice
    ) {
      context.addIssue({ code: 'custom', path: ['minPrice'], message: 'minPrice must not exceed modalPrice' });
    }
    if (
      value.maxPrice !== null &&
      value.maxPrice !== undefined &&
      value.modalPrice !== null &&
      value.modalPrice !== undefined &&
      value.modalPrice > value.maxPrice
    ) {
      context.addIssue({ code: 'custom', path: ['maxPrice'], message: 'modalPrice must not exceed maxPrice' });
    }
    if (
      value.sourceType === 'DEMO' &&
      value.source !== 'DEMO_PROVIDER'
    ) {
      context.addIssue({ code: 'custom', path: ['source'], message: 'Demo records must use DEMO_PROVIDER' });
    }
  });
