import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/database.js';
import type { AuthenticatedRequest } from '../types/auth.js';

const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    phone: z.string().trim().max(40).nullable().optional(),
  })
  .strict();

const publicUserSelect = {
  id: true,
  clerkUserId: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

const getContext = (request: Request): AuthenticatedRequest['authContext'] =>
  (request as AuthenticatedRequest).authContext;

export const getCurrentUser = async (request: Request, response: Response): Promise<void> => {
  const context = getContext(request);
  if (!context) {
    response.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: context.databaseUserId },
    select: publicUserSelect,
  });

  if (!user) {
    response.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'Application user was not found' },
    });
    return;
  }

  response.status(200).json({ success: true, data: { user } });
};

export const updateCurrentUser = async (request: Request, response: Response): Promise<void> => {
  const context = getContext(request);
  if (!context) {
    response.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  const parsed = profileUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      success: false,
      error: { code: 'INVALID_PROFILE', message: 'Profile fields are invalid' },
    });
    return;
  }

  const user = await prisma.user.update({
    where: { id: context.databaseUserId },
    data: parsed.data,
    select: publicUserSelect,
  });

  response.status(200).json({ success: true, data: { user } });
};
