import type { MarketPrice } from '@prisma/client';
import { prisma } from './database.js';
import { providerRecordSchema } from '../validators/marketData.js';

export interface MarketDataProviderRecord {
  sourceRecordId: string;
  marketId: string;
  cropId: string;
  priceDate: Date;
  minPrice?: number | null;
  maxPrice?: number | null;
  modalPrice?: number | null;
  sourceUnit: 'KG' | 'QUINTAL';
  source: string;
  sourceType: 'LIVE' | 'DEMO';
}

export interface MarketDataProvider {
  fetch(): Promise<MarketDataProviderRecord[]>;
}

export class OfficialMarketDataProvider implements MarketDataProvider {
  async fetch(): Promise<MarketDataProviderRecord[]> {
    throw new Error('Official market data provider is not configured');
  }
}

export class DemoMarketDataProvider implements MarketDataProvider {
  async fetch(): Promise<MarketDataProviderRecord[]> {
    const priceDate = new Date('2026-03-01T00:00:00.000Z');
    const previousPriceDate = new Date('2026-02-22T00:00:00.000Z');
    return [
      { sourceRecordId: 'demo-bhopal-wheat-2026-03-01', marketId: 'demo-market-bhopal', cropId: 'demo-crop-wheat', priceDate, minPrice: 2200, modalPrice: 2400, maxPrice: 2600, sourceUnit: 'QUINTAL', source: 'DEMO_PROVIDER', sourceType: 'DEMO' },
      { sourceRecordId: 'demo-indore-soybean-2026-03-01', marketId: 'demo-market-indore', cropId: 'demo-crop-soybean', priceDate, minPrice: 4300, modalPrice: 4500, maxPrice: 4700, sourceUnit: 'QUINTAL', source: 'DEMO_PROVIDER', sourceType: 'DEMO' },
      { sourceRecordId: 'demo-bhopal-wheat-2026-02-22', marketId: 'demo-market-bhopal', cropId: 'demo-crop-wheat', priceDate: previousPriceDate, minPrice: 2150, modalPrice: 2350, maxPrice: 2550, sourceUnit: 'QUINTAL', source: 'DEMO_PROVIDER', sourceType: 'DEMO' },
      { sourceRecordId: 'demo-indore-soybean-2026-02-22', marketId: 'demo-market-indore', cropId: 'demo-crop-soybean', priceDate: previousPriceDate, minPrice: 4250, modalPrice: 4450, maxPrice: 4650, sourceUnit: 'QUINTAL', source: 'DEMO_PROVIDER', sourceType: 'DEMO' },
    ];
  }
}

export const normalizeProviderRecord = (record: MarketDataProviderRecord) => {
  const parsed = providerRecordSchema.parse(record);
  const multiplier = parsed.sourceUnit === 'KG' ? 100 : 1;
  const normalize = (price: number | null | undefined) =>
    price === null || price === undefined ? price : price * multiplier;

  return {
    sourceRecordId: parsed.sourceRecordId,
    marketId: parsed.marketId,
    cropId: parsed.cropId,
    priceDate: parsed.priceDate,
    minPrice: normalize(parsed.minPrice),
    maxPrice: normalize(parsed.maxPrice),
    modalPrice: normalize(parsed.modalPrice),
    normalizedUnit: 'INR_PER_QUINTAL' as const,
    sourceUnit: parsed.sourceUnit,
    source: parsed.source,
    sourceType: parsed.sourceType,
    fetchedAt: new Date(),
  };
};

export const ingestMarketData = async (
  provider: MarketDataProvider,
): Promise<{ created: number; updated: number }> => {
  const records = await provider.fetch();
  let created = 0;
  let updated = 0;

  for (const record of records) {
    const normalized = normalizeProviderRecord(record);
    const existing = await prisma.marketPrice.findUnique({
      where: { source_sourceRecordId: { source: normalized.source, sourceRecordId: normalized.sourceRecordId } },
      select: { id: true },
    });
    await prisma.marketPrice.upsert({
      where: { source_sourceRecordId: { source: normalized.source, sourceRecordId: normalized.sourceRecordId } },
      create: normalized,
      update: normalized,
    });
    if (existing) updated += 1;
    else created += 1;
  }
  return { created, updated };
};

export const toMarketPriceResponse = (price: MarketPrice) => ({
  ...price,
  minPrice: price.minPrice?.toString() ?? null,
  maxPrice: price.maxPrice?.toString() ?? null,
  modalPrice: price.modalPrice?.toString() ?? null,
});
