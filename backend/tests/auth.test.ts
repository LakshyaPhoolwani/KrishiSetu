import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const { mockedGetAuth } = vi.hoisted(() => ({
  mockedGetAuth: vi.fn(),
}));

vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_request: unknown, _response: unknown, next: () => void) => next(),
  getAuth: mockedGetAuth,
}));

import app from '../src/app.js';
import { requireOwnership, requireRole } from '../src/middleware/auth.js';
import { prisma } from '../src/services/database.js';
import type { AuthenticatedRequest } from '../src/types/auth.js';

const authorizationApp = express();
authorizationApp.get(
  '/admin',
  (request, _response, next) => {
    (request as AuthenticatedRequest).authContext = {
      clerkUserId: 'user_clerk_123',
      databaseUserId: 'user_internal_123',
      role: 'FARMER',
      status: 'ACTIVE',
    };
    next();
  },
  requireRole('ADMIN'),
  (_request, response) => response.sendStatus(204),
);
authorizationApp.get(
  '/owned/:ownerId',
  (request, _response, next) => {
    (request as AuthenticatedRequest).authContext = {
      clerkUserId: 'user_clerk_123',
      databaseUserId: 'user_internal_123',
      role: 'FARMER',
      status: 'ACTIVE',
    };
    next();
  },
  requireOwnership((request) => {
    const ownerId = request.params.ownerId;
    return Array.isArray(ownerId) ? ownerId[0] : ownerId;
  }),
  (_request, response) => response.sendStatus(204),
);

describe('protected identity routes', () => {
  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'test-clerk-secret';
    mockedGetAuth.mockReset();
  });

  it('rejects unauthenticated requests with 401', async () => {
    mockedGetAuth.mockReturnValue({ userId: null });

    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns the database-backed user for the verified Clerk identity', async () => {
    mockedGetAuth.mockReturnValue({ userId: 'user_clerk_123' });
    vi.spyOn(prisma.user, 'findUnique')
      .mockResolvedValueOnce({
        id: 'user_internal_123',
        clerkUserId: 'user_clerk_123',
        role: 'FARMER',
        status: 'ACTIVE',
      } as never)
      .mockResolvedValueOnce({
        id: 'user_internal_123',
        clerkUserId: 'user_clerk_123',
        name: 'Asha Farmer',
        email: 'asha@example.com',
        phone: null,
        role: 'FARMER',
        status: 'ACTIVE',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      } as never);

    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.data.user.clerkUserId).toBe('user_clerk_123');
    expect(response.body.data.user.role).toBe('FARMER');
  });

  it('rejects profile attempts to change identity or role fields', async () => {
    mockedGetAuth.mockReturnValue({ userId: 'user_clerk_123' });
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
      id: 'user_internal_123',
      clerkUserId: 'user_clerk_123',
      role: 'FARMER',
      status: 'ACTIVE',
    } as never);

    const response = await request(app).patch('/api/users/me').send({
      clerkUserId: 'attacker',
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_PROFILE');
  });
});

describe('authorization middleware', () => {
  it('rejects a user with the wrong role', async () => {
    const response = await request(authorizationApp).get('/admin');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects access to another user-owned resource', async () => {
    const response = await request(authorizationApp).get('/owned/another-user');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows access to an owned resource', async () => {
    const response = await request(authorizationApp).get('/owned/user_internal_123');

    expect(response.status).toBe(204);
  });
});

describe('Clerk webhook boundary', () => {
  it('rejects webhook requests when verification is not configured', async () => {
    delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;

    const response = await request(app)
      .post('/api/webhooks/clerk')
      .send({ type: 'user.created', data: { id: 'user_clerk_123' } });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('WEBHOOK_NOT_CONFIGURED');
  });
});
