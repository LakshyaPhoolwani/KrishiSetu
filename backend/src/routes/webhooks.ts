import { Router } from 'express';
import { handleClerkWebhook } from '../controllers/webhookController.js';

export const webhooksRouter = Router();

webhooksRouter.post('/clerk', handleClerkWebhook);
