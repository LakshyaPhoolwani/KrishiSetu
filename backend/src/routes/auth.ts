import { Router } from 'express';
import { getCurrentUser } from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.get('/me', requireAuth, getCurrentUser);
