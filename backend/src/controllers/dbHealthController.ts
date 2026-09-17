import type { Request, Response } from 'express';
import { prisma } from '../services/database.js';

export const getDatabaseHealth = async (_req: Request, res: Response): Promise<void> => {
  if (!process.env.DATABASE_URL) {
    res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_NOT_CONFIGURED',
        message: 'Database connection is not configured.',
      },
    });
    return;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        service: 'KrishiSetu database',
      },
    });
  } catch (error) {
    console.error('Database health check failed:', error instanceof Error ? error.message : error);
    res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database connectivity check failed.',
      },
    });
  }
};
