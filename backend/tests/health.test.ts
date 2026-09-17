import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/services/database.js';

describe('Prisma client', () => {
  it('initializes a reusable client instance', () => {
    expect(prisma).toBeDefined();
    expect(typeof prisma.$queryRaw).toBe('function');
  });
});

describe('GET /api/health', () => {
  it('returns the backend health status', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'KrishiSetu backend',
    });
  });

  describe('GET /api/db-health', () => {
    it('returns a safe configuration error when the database is not configured', async () => {
      const originalDatabaseUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      const response = await request(app).get('/api/db-health');

      if (originalDatabaseUrl) {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'DATABASE_NOT_CONFIGURED',
          message: 'Database connection is not configured.',
        },
      });
    });
  });
});
