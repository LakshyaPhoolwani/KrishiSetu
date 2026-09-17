import type { Request } from 'express';
import type { Role, UserStatus } from '@prisma/client';

export interface AuthenticatedUserContext {
  clerkUserId: string;
  databaseUserId: string;
  role: Role;
  status: UserStatus;
}

export interface AuthenticatedRequest extends Request {
  authContext?: AuthenticatedUserContext;
}
