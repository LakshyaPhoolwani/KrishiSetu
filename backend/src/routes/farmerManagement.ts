import { Router } from 'express';
import {
  getFarmerProfile,
  updateFarmerProfile,
} from '../controllers/farmerController.js';
import {
  createFarm,
  deleteFarm,
  getFarm,
  listFarms,
  updateFarm,
} from '../controllers/farmController.js';
import { getCrop, listCrops } from '../controllers/cropController.js';
import {
  createLot,
  deleteLot,
  getLot,
  listLots,
  updateLot,
} from '../controllers/lotController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const farmerManagementRouter = Router();
const requireFarmer = [requireAuth, requireRole('FARMER')];

farmerManagementRouter.get('/farmers/me', ...requireFarmer, getFarmerProfile);
farmerManagementRouter.patch('/farmers/me', ...requireFarmer, updateFarmerProfile);

farmerManagementRouter.post('/farms', ...requireFarmer, createFarm);
farmerManagementRouter.get('/farms', ...requireFarmer, listFarms);
farmerManagementRouter.get('/farms/:id', ...requireFarmer, getFarm);
farmerManagementRouter.patch('/farms/:id', ...requireFarmer, updateFarm);
farmerManagementRouter.delete('/farms/:id', ...requireFarmer, deleteFarm);

farmerManagementRouter.get('/crops', requireAuth, listCrops);
farmerManagementRouter.get('/crops/:id', requireAuth, getCrop);

farmerManagementRouter.post('/lots', ...requireFarmer, createLot);
farmerManagementRouter.get('/lots', ...requireFarmer, listLots);
farmerManagementRouter.get('/lots/:id', ...requireFarmer, getLot);
farmerManagementRouter.patch('/lots/:id', ...requireFarmer, updateLot);
farmerManagementRouter.delete('/lots/:id', ...requireFarmer, deleteLot);
