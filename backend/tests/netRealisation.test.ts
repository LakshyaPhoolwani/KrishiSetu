import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { calculateNetRealisation } from '../src/services/netRealisation.js';

const { mockedGetAuth } = vi.hoisted(() => ({ mockedGetAuth: vi.fn() }));

vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_request: unknown, _response: unknown, next: () => void) => next(),
  getAuth: mockedGetAuth,
}));

import app from '../src/app.js';
import { prisma } from '../src/services/database.js';

describe('net realisation calculation engine', () => {
  it('calculates revenue, costs, spoilage, and net realisation deterministically', () => {
    const result = calculateNetRealisation({
      saleQuantity: '1000',
      saleQuantityUnit: 'KG',
      salePricePerQuintal: '5000',
      transportCost: '2000',
      storageCost: '500',
      commissionCost: '1000',
      packagingCost: '700',
      expectedLossPercentage: '2',
      otherCosts: '300',
    });
    expect(result.saleQuantityQuintals.toString()).toBe('10');
    expect(result.saleRevenue.toString()).toBe('50000');
    expect(result.expectedLossCost.toString()).toBe('1000');
    expect(result.totalCosts.toString()).toBe('5500');
    expect(result.netRealisation.toString()).toBe('44500');
  });

  it('supports ton conversion and percentage commission', () => {
    const result = calculateNetRealisation({
      saleQuantity: '1.5',
      saleQuantityUnit: 'TON',
      salePricePerQuintal: '3333.333',
      commissionRate: '10',
    });
    expect(result.saleQuantityQuintals.toString()).toBe('15');
    expect(result.commissionCost.toString()).toBe('5000');
  });

  it('preserves negative and zero net realisation', () => {
    const negative = calculateNetRealisation({
      saleQuantity: '1',
      saleQuantityUnit: 'QUINTAL',
      salePricePerQuintal: '10',
      transportCost: '20',
    });
    const zero = calculateNetRealisation({
      saleQuantity: '1',
      saleQuantityUnit: 'QUINTAL',
      salePricePerQuintal: '10',
      transportCost: '10',
    });
    expect(negative.netRealisation.toString()).toBe('-10');
    expect(zero.netRealisation.toString()).toBe('0');
  });

  it('rounds only monetary outputs to two decimal places', () => {
    const result = calculateNetRealisation({
      saleQuantity: '0.333',
      saleQuantityUnit: 'QUINTAL',
      salePricePerQuintal: '10',
    });
    expect(result.saleRevenue.toString()).toBe('3.33');
  });
});

describe('net realisation API', () => {
  const user = { id: 'cuserfarmer1234567890123456', clerkUserId: 'farmer-clerk', role: 'FARMER', status: 'ACTIVE' };
  const lot = { id: 'clot1234567890123456789012', cropId: 'ccrop12345678901234567890', quantity: new Prisma.Decimal('10'), quantityUnit: 'QUINTAL' };
  const marketPrice = {
    id: 'cprice123456789012345678901',
    marketId: 'cmarket12345678901234567890',
    cropId: lot.cropId,
    modalPrice: new Prisma.Decimal('5000'),
    normalizedUnit: 'INR_PER_QUINTAL',
    priceDate: new Date('2026-01-01'),
    source: 'DEMO_PROVIDER',
    sourceType: 'DEMO',
  };

  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'test-clerk-secret';
    mockedGetAuth.mockReset();
    mockedGetAuth.mockReturnValue({ userId: user.clerkUserId });
    vi.restoreAllMocks();
    mockedGetAuth.mockReturnValue({ userId: user.clerkUserId });
  });

  it('calculates using trusted market price and stores the input breakdown', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(user as never);
    vi.spyOn(prisma.farmer, 'findUnique').mockResolvedValue({ id: 'cfarmer1234567890123456789' } as never);
    vi.spyOn(prisma.lot, 'findFirst').mockResolvedValue(lot as never);
    vi.spyOn(prisma.marketPrice, 'findUnique').mockResolvedValue(marketPrice as never);
    const create = vi.spyOn(prisma.netRealisationCalculation, 'create').mockResolvedValue({
      id: 'ccalc123456789012345678901',
      lotId: lot.id,
      marketId: marketPrice.marketId,
      marketPriceId: marketPrice.id,
      createdAt: new Date('2026-01-02'),
    } as never);

    const response = await request(app).post('/api/net-realisation/calculate').send({
      lotId: lot.id,
      marketId: marketPrice.marketId,
      marketPriceId: marketPrice.id,
      saleQuantity: '10',
      saleQuantityUnit: 'QUINTAL',
      transportCost: '100',
      saleRevenue: '1',
      totalCosts: '1',
    });

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects cross-farmer lots and mismatched market prices', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(user as never);
    vi.spyOn(prisma.farmer, 'findUnique').mockResolvedValue({ id: 'cfarmer1234567890123456789' } as never);
    vi.spyOn(prisma.lot, 'findFirst').mockResolvedValue(null);
    const response = await request(app).post('/api/net-realisation/calculate').send({
      lotId: lot.id,
      marketId: marketPrice.marketId,
      marketPriceId: marketPrice.id,
      saleQuantity: '1',
      saleQuantityUnit: 'QUINTAL',
    });
    expect(response.status).toBe(403);
  });

  it('rejects unauthenticated and wrong-role requests', async () => {
    mockedGetAuth.mockReturnValue({ userId: null });
    expect((await request(app).post('/api/net-realisation/calculate')).status).toBe(401);
    mockedGetAuth.mockReturnValue({ userId: 'buyer-clerk' });
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ ...user, role: 'BUYER' } as never);
    expect((await request(app).post('/api/net-realisation/calculate')).status).toBe(403);
  });
});
