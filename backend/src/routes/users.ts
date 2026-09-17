import { Router } from 'express';
import { getCurrentUser, updateCurrentUser } from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, getCurrentUser);
usersRouter.patch('/me', requireAuth, updateCurrentUser);
