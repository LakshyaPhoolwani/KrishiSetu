import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getBuyerProfile, updateBuyerProfile } from '../controllers/buyerController.js';
import {
  cancelBuyerDemand,
  createBuyerDemand,
  getBuyerDemand,
  listBuyerDemands,
  updateBuyerDemand,
} from '../controllers/buyerDemandController.js';

export const buyerDemandRouter = Router();
const requireBuyer = [requireAuth, requireRole('BUYER')];

buyerDemandRouter.get('/buyers/me', ...requireBuyer, getBuyerProfile);
buyerDemandRouter.patch('/buyers/me', ...requireBuyer, updateBuyerProfile);
buyerDemandRouter.post('/buyer-demands', ...requireBuyer, createBuyerDemand);
buyerDemandRouter.get('/buyer-demands', ...requireBuyer, listBuyerDemands);
buyerDemandRouter.get('/buyer-demands/:id', ...requireBuyer, getBuyerDemand);
buyerDemandRouter.patch('/buyer-demands/:id', ...requireBuyer, updateBuyerDemand);
buyerDemandRouter.delete('/buyer-demands/:id', ...requireBuyer, cancelBuyerDemand);
