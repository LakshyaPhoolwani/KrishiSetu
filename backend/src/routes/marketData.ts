import { Router } from 'express';
import { getMarket, listMarkets } from '../controllers/marketController.js';
import { getMarketPrice, listMarketPrices } from '../controllers/marketPriceController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { DemoMarketDataProvider, ingestMarketData } from '../services/marketData.js';

export const marketDataRouter = Router();

marketDataRouter.get('/markets', requireAuth, listMarkets);
marketDataRouter.get('/markets/:id', requireAuth, getMarket);
marketDataRouter.get('/market-prices', requireAuth, listMarketPrices);
marketDataRouter.get('/market-prices/:id', requireAuth, getMarketPrice);

marketDataRouter.post(
  '/admin/market-data/ingest-demo',
  requireAuth,
  requireRole('ADMIN'),
  async (_request, response, next) => {
    try {
      const result = await ingestMarketData(new DemoMarketDataProvider());
      response.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);
