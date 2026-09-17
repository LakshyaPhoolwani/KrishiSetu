import express from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/index.js';

const app = express();

app.use(express.json());
app.use('/api', healthRouter);
app.use(errorHandler);

export default app;
