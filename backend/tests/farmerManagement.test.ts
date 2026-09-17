import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { mockedGetAuth } = vi.hoisted(() => ({
  mockedGetAuth: vi.fn(),
}));

vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_request: unknown, _response: unknown, next: () => void) => next(),
  getAuth: mockedGetAuth,
}));

import app from '../src/app.js';
import { prisma } from '../src/services/database.js';

const user = {
  id: 'cuserinternal1234567890123',
  clerkUserId: 'user_clerk_farmer',
  role: 'FARMER',
  status: 'ACTIVE',
};
const farmer = { id: 'cfarmer12345678901234567', userId: user.id, fpoId: null };
const farm = { id: 'cfarm1234567890123456789', farmerId: farmer.id, name: 'North Farm' };
const crop = { id: 'ccrop12345678901234567890', name: 'Rice' };

describe('farmer management APIs', () => {
  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'test-clerk-secret';
    mockedGetAuth.mockReturnValue({ userId: user.clerkUserId });
    vi.restoreAllMocks();
    mockedGetAuth.mockReturnValue({ userId: user.clerkUserId });
  });

  it('returns the authenticated farmer profile without accepting an ID', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(user as never);
    vi.spyOn(prisma.farmer, 'findUnique').mockResolvedValue(farmer as never);

    const response = await request(app).get('/api/farmers/me');

    expect(response.status).toBe(200);
    expect(response.body.data.farmer.userId).toBe(user.id);
  });

  it('creates a farm using the authenticated farmer ownership', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(user as never);
    vi.spyOn(prisma.farmer, 'findUnique').mockResolvedValue(farmer as never);
    const create = vi.spyOn(prisma.farm, 'create').mockResolvedValue(farm as never);

    const response = await request(app).post('/api/farms').send({
      name: 'North Farm',
      area: 4,
      areaUnit: 'ACRE',
      pincode: '560001',
    });

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ farmerId: farmer.id, name: 'North Farm' }),
    });
  });

  it('rejects access to another farmer-owned farm', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(user as never);
    vi.spyOn(prisma.farmer, 'findUnique').mockResolvedValue(farmer as never);
    vi.spyOn(prisma.farm, 'findFirst').mockResolvedValue(null);

    const response = await request(app).get('/api/farms/cotherfarm1234567890123456');

    expect(response.status).toBe(403);
  });

  it('creates a draft lot with a server-generated lot code', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(user as never);
    vi.spyOn(prisma.farmer, 'findUnique').mockResolvedValue(farmer as never);
    vi.spyOn(prisma.farm, 'findFirst').mockResolvedValue(farm as never);
    vi.spyOn(prisma.crop, 'findUnique').mockResolvedValue(crop as never);
    vi.spyOn(prisma.lot, 'findUnique').mockResolvedValue(null);
    const create = vi.spyOn(prisma.lot, 'create').mockResolvedValue({
      lotCode: 'LOT-2026-ABC123',
      status: 'DRAFT',
    } as never);

    const response = await request(app).post('/api/lots').send({
      farmId: farm.id,
      cropId: crop.id,
      quantity: 10,
      quantityUnit: 'QUINTAL',
    });

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        farmerId: farmer.id,
        lotCode: expect.stringMatching(/^LOT-\d{4}-[A-Z0-9]+$/),
      }),
      include: { farm: true, crop: true },
    });
  });

  it('rejects invalid lot quantity and protected lot fields', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(user as never);
    vi.spyOn(prisma.farmer, 'findUnique').mockResolvedValue(farmer as never);

    const response = await request(app).post('/api/lots').send({
      farmerId: 'attacker',
      lotCode: 'LOT-2026-000001',
      farmId: farm.id,
      cropId: crop.id,
      quantity: 0,
      quantityUnit: 'INVALID',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_LOT');
  });
});
