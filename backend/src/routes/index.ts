import { Router } from 'express';
import { getDatabaseHealth } from '../controllers/dbHealthController.js';
import { getHealthStatus } from '../controllers/healthController.js';

export const healthRouter = Router();

healthRouter.get('/health', getHealthStatus);
healthRouter.get('/db-health', getDatabaseHealth);
