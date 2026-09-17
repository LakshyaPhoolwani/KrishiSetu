import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { chat } from '../controllers/aiController.js';

export const aiRouter = Router();
aiRouter.post('/ai/chat', requireAuth, chat);
