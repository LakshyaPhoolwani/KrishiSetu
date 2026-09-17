import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { mockedVerifyWebhook } = vi.hoisted(() => ({
  mockedVerifyWebhook: vi.fn(),
}));

vi.mock('@clerk/express/webhooks', () => ({
  verifyWebhook: mockedVerifyWebhook,
}));

import app from '../src/app.js';
import { prisma } from '../src/services/database.js';

describe('Clerk user webhooks', () => {
  beforeEach(() => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = 'test-webhook-secret';
    mockedVerifyWebhook.mockReset();
  });

  it('upserts a verified user.created event with a safe default role', async () => {
    mockedVerifyWebhook.mockResolvedValue({
      type: 'user.created',
      data: {
        id: 'user_clerk_123',
        first_name: 'Asha',
        last_name: 'Farmer',
        primary_email_address_id: 'email_1',
        email_addresses: [{ id: 'email_1', email_address: 'asha@example.com' }],
      },
    });
    const upsert = vi.spyOn(prisma.user, 'upsert').mockResolvedValue({} as never);

    const response = await request(app).post('/api/webhooks/clerk').send({});

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkUserId: 'user_clerk_123' },
        create: expect.objectContaining({
          clerkUserId: 'user_clerk_123',
          role: 'FARMER',
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('rejects an invalid webhook signature', async () => {
    mockedVerifyWebhook.mockRejectedValue(new Error('invalid signature'));

    const response = await request(app).post('/api/webhooks/clerk').send({});

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_WEBHOOK');
  });

  it('deactivates a verified user.deleted event', async () => {
    mockedVerifyWebhook.mockResolvedValue({
      type: 'user.deleted',
      data: { id: 'user_clerk_123' },
    });
    const updateMany = vi.spyOn(prisma.user, 'updateMany').mockResolvedValue({ count: 1 });

    const response = await request(app).post('/api/webhooks/clerk').send({});

    expect(response.status).toBe(200);
    expect(updateMany).toHaveBeenCalledWith({
      where: { clerkUserId: 'user_clerk_123' },
      data: { status: 'INACTIVE' },
    });
  });
});
