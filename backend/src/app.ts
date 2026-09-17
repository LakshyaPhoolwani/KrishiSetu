import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/index.js';
import { usersRouter } from './routes/users.js';
import { webhooksRouter } from './routes/webhooks.js';
import { farmerManagementRouter } from './routes/farmerManagement.js';
import { marketDataRouter } from './routes/marketData.js';

const app = express();

app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRouter);
if (process.env.CLERK_SECRET_KEY) {
  app.use(clerkMiddleware());
}
app.use(express.json());
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api', farmerManagementRouter);
app.use('/api', marketDataRouter);
app.use(errorHandler);

export default app;
