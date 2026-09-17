# Market data

Phase 4 provides authenticated, paginated market and market-price reads backed by
the existing Prisma `Market`, `Crop`, and `MarketPrice` models.

## Data trust and sources

`MarketPrice` stores `source`, `sourceType`, `sourceRecordId`, `priceDate`, and
`fetchedAt`. `sourceType` is either `DEMO` or `LIVE`; demo records use
`DEMO_PROVIDER` and are never presented as government or current live data.
The admin-only demo ingestion endpoint is `POST /api/admin/market-data/ingest-demo`.
There is no official government provider integration yet. The official provider
adapter intentionally fails until a verified provider and credentials are
available.

Provider records are validated, normalized to INR per quintal, and upserted by
`source + sourceRecordId`. Kilograms are explicitly converted by multiplying by
100; unsupported units and impossible price relationships are rejected.

## APIs

Authenticated users can call:

- `GET /api/markets?page=1&limit=20&state=...&district=...&active=true&cropId=...`
- `GET /api/markets/:id`
- `GET /api/market-prices?page=1&limit=20&marketId=...&cropId=...&fromDate=...&toDate=...&source=...&sourceType=...`
- `GET /api/market-prices/:id`

List APIs cap `limit` at 100 and return `{ data, pagination }`. Price history is
ordered by `priceDate DESC` with an ID tie-breaker. `priceDate` is the date
represented by the observation; `fetchedAt` is when KrishiSetu obtained it.

`backend/prisma/seed.ts` adds deterministic demo markets and crops without
deleting existing data. It does not create prices or claim live data; use the
privileged demo ingestion endpoint after seeding.

## Utilities and limitations

`calculateDistanceKm` uses Haversine distance between validated coordinates.
`calculatePriceStatistics` calculates min/max, average modal price, observation
count, and first/latest change. It does not forecast prices, calculate transport
costs, or calculate net realisation.
