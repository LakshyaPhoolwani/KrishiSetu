import { getAuth } from '@clerk/express';
import type { NextFunction, RequestHandler, Response } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../services/database.js';
import type { AuthenticatedRequest } from '../types/auth.js';

const unauthorized = (res: Response, message = 'Authentication required'): void => {
  res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message },
  });
};

export const requireAuth: RequestHandler = async (
  request,
  response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!process.env.CLERK_SECRET_KEY) {
      response.status(503).json({
        success: false,
        error: { code: 'AUTH_NOT_CONFIGURED', message: 'Authentication is not configured' },
      });
      return;
    }

    const { userId: clerkUserId } = getAuth(request);
    if (!clerkUserId) {
      unauthorized(response);
      return;
    }

    const databaseUser = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true, clerkUserId: true, role: true, status: true },
    });

    if (!databaseUser || !databaseUser.clerkUserId) {
      unauthorized(response, 'Application user is not synchronized');
      return;
    }

    if (databaseUser.status !== 'ACTIVE') {
      response.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'User account is not active' },
      });
      return;
    }

    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.authContext = {
      clerkUserId: databaseUser.clerkUserId,
      databaseUserId: databaseUser.id,
      role: databaseUser.role,
      status: databaseUser.status,
    };
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...allowedRoles: Role[]): RequestHandler => {
  return (request, response, next): void => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const context = authenticatedRequest.authContext;

    if (!context) {
      unauthorized(response);
      return;
    }

    if (!allowedRoles.includes(context.role)) {
      response.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action' },
      });
      return;
    }

    next();
  };
};

export type OwnershipResolver = (
  request: AuthenticatedRequest,
) => string | Promise<string | undefined> | undefined;

export const requireOwnership = (resolveOwnerId: OwnershipResolver): RequestHandler => {
  return async (request, response, next): Promise<void> => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const context = authenticatedRequest.authContext;
      if (!context) {
        unauthorized(response);
        return;
      }

      const ownerId = await resolveOwnerId(authenticatedRequest);
      if (!ownerId || ownerId !== context.databaseUserId) {
        response.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not own this resource' },
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
