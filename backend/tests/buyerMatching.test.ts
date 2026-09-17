import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { evaluateBuyerDemandMatch } from '../src/services/buyerMatching.js';

const { mockedGetAuth } = vi.hoisted(() => ({ mockedGetAuth: vi.fn() }));
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_request: unknown, _response: unknown, next: () => void) => next(),
  getAuth: mockedGetAuth,
}));

import app from '../src/app.js';
import { prisma } from '../src/services/database.js';

const lot = {
  id: 'clot1234567890123456789012',
  cropId: 'ccrop12345678901234567890',
  quantity: new Prisma.Decimal('1000'),
  quantityUnit: 'KG' as const,
  status: 'READY_FOR_MARKET',
  qualityGrade: 'A',
  qualityNotes: null,
  farm: { state: 'Madhya Pradesh', district: 'Bhopal' },
};

const demand = (overrides: Record<string, unknown> = {}) => ({
  id: 'cdemand1234567890123456789',
  cropId: lot.cropId,
  quantity: new Prisma.Decimal('8'),
  quantityUnit: 'QUINTAL' as const,
  minimumQuantity: new Prisma.Decimal('5'),
  preferredMarketId: null,
  preferredState: 'Madhya Pradesh',
  preferredDistrict: 'Bhopal',
  qualityRequirement: 'A',
  minimumPrice: new Prisma.Decimal('2000'),
  maximumPrice: new Prisma.Decimal('3000'),
  validFrom: new Date('2026-01-01'),
  validUntil: new Date('2026-12-31'),
  status: 'ACTIVE',
  buyer: { id: 'cbuyer12345678901234567890', businessName: 'Active Buyer', buyerType: 'TRADER', status: 'ACTIVE' },
  ...overrides,
});

const marketPrice = {
  marketId: 'cmarket12345678901234567890',
  cropId: lot.cropId,
  modalPrice: new Prisma.Decimal('2500'),
  normalizedUnit: 'INR_PER_QUINTAL',
  priceDate: new Date('2026-01-10'),
  source: 'DEMO_PROVIDER',
  sourceType: 'DEMO',
};

describe('pure buyer matching engine', () => {
  const evaluatedAt = new Date('2026-06-01');

  it('matches crop, quantity, status, date, quality, location, and price', () => {
    const result = evaluateBuyerDemandMatch(lot, demand(), evaluatedAt, marketPrice);
    expect(result.eligible).toBe(true);
    expect(result.quantity).toMatchObject({ lotQuantity: '10', minimumRequiredQuantity: '5', normalizedUnit: 'QUINTAL' });
    expect(result.reasons).toEqual(expect.arrayContaining([
      'LOT_ELIGIBLE', 'CROP_MATCH', 'QUANTITY_MATCH', 'BUYER_ACTIVE',
      'DEMAND_ACTIVE', 'DEMAND_VALID', 'QUALITY_MATCH', 'LOCATION_MATCH', 'PRICE_WITHIN_RANGE',
    ]));
  });

  it('handles quantity conversion and insufficient quantity', () => {
    const result = evaluateBuyerDemandMatch(lot, demand({ minimumQuantity: new Prisma.Decimal('11') }), evaluatedAt, marketPrice);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('QUANTITY_INSUFFICIENT');
  });

  it('rejects mismatched crop, quality, location, and price', () => {
    const result = evaluateBuyerDemandMatch(
      lot,
      demand({
        cropId: 'cothercrop12345678901234567',
        qualityRequirement: 'B',
        preferredState: 'Rajasthan',
        minimumPrice: new Prisma.Decimal('3000'),
      }),
      evaluatedAt,
      { ...marketPrice, modalPrice: new Prisma.Decimal('2500') },
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining(['CROP_MISMATCH', 'QUALITY_MISMATCH', 'LOCATION_MISMATCH', 'PRICE_OUTSIDE_RANGE']));
  });

  it('rejects inactive, cancelled, expired, future, and unavailable lots', () => {
    for (const overrides of [
      { status: 'SOLD' },
      { status: 'CANCELLED' },
      { buyer: { ...demand().buyer, status: 'SUSPENDED' } },
      { status: 'CANCELLED' },
      { validUntil: new Date('2026-05-01') },
      { validFrom: new Date('2026-07-01') },
    ]) {
      const result = evaluateBuyerDemandMatch(lot, demand(overrides), evaluatedAt, marketPrice);
      expect(result.eligible).toBe(false);
    }
  });

  it('does not require unspecified quality, location, or price constraints', () => {
    const result = evaluateBuyerDemandMatch(
      { ...lot, qualityGrade: null },
      demand({ qualityRequirement: null, preferredState: null, preferredDistrict: null, minimumPrice: null, maximumPrice: null }),
      evaluatedAt,
    );
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual(expect.arrayContaining(['QUALITY_NOT_SPECIFIED', 'LOCATION_NOT_SPECIFIED', 'PRICE_CONSTRAINT_NOT_SPECIFIED']));
  });

  it('reports insufficient information for preferred market and constrained price without context', () => {
    const result = evaluateBuyerDemandMatch(
      lot,
      demand({ preferredMarketId: marketPrice.marketId, preferredState: null, preferredDistrict: null }),
      evaluatedAt,
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('LOCATION_INFORMATION_INSUFFICIENT');
    expect(result.reasons).toContain('PRICE_INFORMATION_INSUFFICIENT');
  });

  it('is deterministic for identical inputs', () => {
    const first = evaluateBuyerDemandMatch(lot, demand(), evaluatedAt, marketPrice);
    const second = evaluateBuyerDemandMatch(lot, demand(), evaluatedAt, marketPrice);
    expect(second).toEqual(first);
  });
});

describe('buyer matching API', () => {
  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'test-clerk-secret';
    mockedGetAuth.mockReset();
    mockedGetAuth.mockReturnValue({ userId: 'farmer-clerk' });
    vi.restoreAllMocks();
    mockedGetAuth.mockReturnValue({ userId: 'farmer-clerk' });
  });

  it('returns deterministic matches for an owned lot without mutating data', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: 'cuserfarmer1234567890123456', clerkUserId: 'farmer-clerk', role: 'FARMER', status: 'ACTIVE' } as never);
    vi.spyOn(prisma.farmer, 'findUnique').mockResolvedValue({ id: 'cfarmer1234567890123456789' } as never);
    vi.spyOn(prisma.lot, 'findFirst').mockResolvedValue(lot as never);
    vi.spyOn(prisma.buyerDemand, 'findMany').mockResolvedValue([demand()] as never);
    vi.spyOn(prisma.marketPrice, 'findFirst').mockResolvedValue(marketPrice as never);

    const response = await request(app).get(`/api/buyer-matching/lots/${lot.id}?marketId=${marketPrice.marketId}&eligibleOnly=true&limit=10`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].eligible).toBe(true);
    expect(vi.spyOn(prisma.lot, 'update')).not.toHaveBeenCalled();
    expect(vi.spyOn(prisma.buyerDemand, 'update')).not.toHaveBeenCalled();
  });

  it('rejects cross-farmer, malformed, unauthenticated, and wrong-role requests', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: 'cuserfarmer1234567890123456', clerkUserId: 'farmer-clerk', role: 'FARMER', status: 'ACTIVE' } as never);
    vi.spyOn(prisma.farmer, 'findUnique').mockResolvedValue({ id: 'cfarmer1234567890123456789' } as never);
    vi.spyOn(prisma.lot, 'findFirst').mockResolvedValue(null);
    expect((await request(app).get('/api/buyer-matching/lots/not-a-cuid')).status).toBe(400);
    expect((await request(app).get(`/api/buyer-matching/lots/${lot.id}`)).status).toBe(403);

    mockedGetAuth.mockReturnValue({ userId: null });
    expect((await request(app).get(`/api/buyer-matching/lots/${lot.id}`)).status).toBe(401);

    mockedGetAuth.mockReturnValue({ userId: 'buyer-clerk' });
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: 'cuserbuyer1234567890123456', clerkUserId: 'buyer-clerk', role: 'BUYER', status: 'ACTIVE' } as never);
    expect((await request(app).get(`/api/buyer-matching/lots/${lot.id}`)).status).toBe(403);
  });
});
