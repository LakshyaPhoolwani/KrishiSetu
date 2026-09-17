import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { mockedGetAuth } = vi.hoisted(() => ({ mockedGetAuth: vi.fn() }));

vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_request: unknown, _response: unknown, next: () => void) => next(),
  getAuth: mockedGetAuth,
}));

import app from '../src/app.js';
import { prisma } from '../src/services/database.js';

const user = {
  id: 'cuserbuyer1234567890123456',
  clerkUserId: 'user_clerk_buyer',
  role: 'BUYER',
  status: 'ACTIVE',
};
const buyer = {
  id: 'cbuyer12345678901234567890',
  userId: user.id,
  businessName: 'Grain House',
  buyerType: 'TRADER',
  status: 'PENDING_VERIFICATION',
};
const crop = { id: 'ccrop12345678901234567890', name: 'Wheat' };
const demand = {
  id: 'cdemand1234567890123456789',
  buyerId: buyer.id,
  cropId: crop.id,
  quantity: 20,
  quantityUnit: 'QUINTAL',
  status: 'DRAFT',
  validFrom: new Date('2026-01-01'),
  validUntil: null,
};

describe('buyer and buyer demand APIs', () => {
  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'test-clerk-secret';
    mockedGetAuth.mockReset();
    mockedGetAuth.mockReturnValue({ userId: user.clerkUserId });
    vi.restoreAllMocks();
    mockedGetAuth.mockReturnValue({ userId: user.clerkUserId });
  });

  it('returns and updates only the authenticated buyer profile', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(user as never);
    vi.spyOn(prisma.buyer, 'findUnique')
      .mockResolvedValueOnce(buyer as never)
      .mockResolvedValueOnce(buyer as never);
    const update = vi.spyOn(prisma.buyer, 'update').mockResolvedValue({ ...buyer, businessName: 'New Grain House' } as never);

    const profile = await request(app).get('/api/buyers/me');
    const updated = await request(app).patch('/api/buyers/me').send({
      businessName: 'New Grain House',
      userId: 'attacker',
      status: 'ACTIVE',
      role: 'ADMIN',
    });

    expect(profile.status).toBe(200);
    expect(updated.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('creates a draft demand using server-derived buyer ownership', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(user as never);
    vi.spyOn(prisma.buyer, 'findUnique').mockResolvedValue(buyer as never);
    const create = vi.spyOn(prisma.buyerDemand, 'create').mockResolvedValue({ ...demand, crop } as never);

    const response = await request(app).post('/api/buyer-demands').send({
      cropId: crop.id,
      quantity: 20,
      quantityUnit: 'QUINTAL',
    });

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ buyerId: buyer.id, status: 'DRAFT', cropId: crop.id }),
      include: { crop: true, preferredMarket: true },
    });
  });

  it('rejects invalid demand quantities, prices, and dates', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(user as never);
    vi.spyOn(prisma.buyer, 'findUnique').mockResolvedValue(buyer as never);

    const response = await request(app).post('/api/buyer-demands').send({
      cropId: crop.id,
      quantity: 0,
      quantityUnit: 'INVALID',
      minimumPrice: 100,
      maximumPrice: 10,
      validFrom: '2026-03-01',
      validUntil: '2026-02-01',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_BUYER_DEMAND');
  });

  it('lists only the authenticated buyer demands with pagination', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(user as never);
    vi.spyOn(prisma.buyer, 'findUnique').mockResolvedValue(buyer as never);
    vi.spyOn(prisma.buyerDemand, 'findMany').mockResolvedValue([demand] as never);
    vi.spyOn(prisma.buyerDemand, 'count').mockResolvedValue(1);
    vi.spyOn(prisma, '$transaction').mockResolvedValue([[demand], 1] as never);

    const response = await request(app).get('/api/buyer-demands?page=1&limit=10&status=DRAFT');

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    expect(vi.mocked(prisma.buyerDemand.findMany)).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ buyerId: buyer.id, status: 'DRAFT' }),
    }));
  });

  it('rejects cross-buyer demand access and updates', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(user as never);
    vi.spyOn(prisma.buyer, 'findUnique').mockResolvedValue(buyer as never);
    vi.spyOn(prisma.buyerDemand, 'findFirst').mockResolvedValue(null);

    const getResponse = await request(app).get(`/api/buyer-demands/${demand.id}`);
    const patchResponse = await request(app).patch(`/api/buyer-demands/${demand.id}`).send({ status: 'ACTIVE' });
    const deleteResponse = await request(app).delete(`/api/buyer-demands/${demand.id}`);

    expect(getResponse.status).toBe(403);
    expect(patchResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
  });

  it('enforces demand status transitions', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(user as never);
    vi.spyOn(prisma.buyer, 'findUnique').mockResolvedValue(buyer as never);
    vi.spyOn(prisma.buyerDemand, 'findFirst').mockResolvedValue({ ...demand, status: 'FULFILLED' } as never);

    const response = await request(app).patch(`/api/buyer-demands/${demand.id}`).send({ status: 'ACTIVE' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_DEMAND_TRANSITION');
  });

  it('cancels a demand instead of deleting its history', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(user as never);
    vi.spyOn(prisma.buyer, 'findUnique').mockResolvedValue(buyer as never);
    vi.spyOn(prisma.buyerDemand, 'findFirst').mockResolvedValue({ ...demand, status: 'ACTIVE' } as never);
    const update = vi.spyOn(prisma.buyerDemand, 'update').mockResolvedValue({ ...demand, status: 'CANCELLED' } as never);

    const response = await request(app).delete(`/api/buyer-demands/${demand.id}`);

    expect(response.status).toBe(204);
    expect(update).toHaveBeenCalledWith({ where: { id: demand.id }, data: { status: 'CANCELLED' } });
  });

  it('rejects non-buyers and unauthenticated users', async () => {
    mockedGetAuth.mockReturnValue({ userId: null });
    const unauthenticated = await request(app).get('/api/buyers/me');
    expect(unauthenticated.status).toBe(401);

    mockedGetAuth.mockReturnValue({ userId: 'user_clerk_farmer' });
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ ...user, role: 'FARMER' } as never);
    const farmer = await request(app).get('/api/buyers/me');
    expect(farmer.status).toBe(403);
  });
});
