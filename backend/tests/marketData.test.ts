import { describe, expect, it } from 'vitest';
import { calculateDistanceKm } from '../src/utils/geo.js';
import { normalizeProviderRecord } from '../src/services/marketData.js';
import { calculatePriceStatistics } from '../src/services/priceStatistics.js';

describe('market data foundation', () => {
  it('normalizes kilograms to quintals without changing source metadata', () => {
    const normalized = normalizeProviderRecord({
      sourceRecordId: 'provider-1',
      marketId: 'cmkt12345',
      cropId: 'ccrop12345',
      priceDate: new Date('2026-01-01'),
      minPrice: 20,
      modalPrice: 25,
      maxPrice: 30,
      sourceUnit: 'KG',
      source: 'TEST_PROVIDER',
      sourceType: 'LIVE',
    });
    expect(normalized.modalPrice).toBe(2500);
    expect(normalized.normalizedUnit).toBe('INR_PER_QUINTAL');
    expect(normalized.sourceUnit).toBe('KG');
  });

  it('calculates deterministic statistics and avoids division by zero', () => {
    const statistics = calculatePriceStatistics([
      { priceDate: new Date('2026-01-01'), modalPrice: 0 },
      { priceDate: new Date('2026-01-02'), modalPrice: 10 },
    ]);
    expect(statistics.minimumPrice).toBe(0);
    expect(statistics.maximumPrice).toBe(10);
    expect(statistics.averageModalPrice).toBe(5);
    expect(statistics.percentageChange).toBeNull();
  });

  it('calculates geographic distance using Haversine', () => {
    expect(calculateDistanceKm(0, 0, 0, 1)).toBeCloseTo(111.19, 1);
  });
});
