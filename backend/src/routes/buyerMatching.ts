import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listBuyerMatches } from '../controllers/buyerMatchingController.js';

export const buyerMatchingRouter = Router();

buyerMatchingRouter.get('/buyer-matching/lots/:lotId', requireAuth, requireRole('FARMER'), listBuyerMatches);
