import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { calculateNetRealisationForLot } from '../controllers/netRealisationController.js';

export const netRealisationRouter = Router();

netRealisationRouter.post(
  '/net-realisation/calculate',
  requireAuth,
  requireRole('FARMER'),
  calculateNetRealisationForLot,
);
