# Buyer Matching Engine

Phase 7 provides a deterministic, read-only compatibility evaluation between
a farmer-owned Lot and existing BuyerDemand records. It does not select a
winner, sell produce, reserve quantity, create offers, or create transactions.

## Eligibility rules

The evaluator checks:

- Lot status: only `READY_FOR_MARKET`
- Buyer status: only `ACTIVE`
- Demand status: only `ACTIVE`
- Demand validity at an explicitly supplied evaluation time
- Crop identity through Crop IDs
- Quantity normalized to QUINTAL (`100 KG = 1 QUINTAL`, `1 TON = 10 QUINTAL`)
- Minimum quantity when present, otherwise requested quantity
- Exact case-insensitive quality-grade matching when a quality requirement exists
- Exact farmer-farm state/district matching when location constraints exist
- Trusted normalized MarketPrice modal price when price constraints exist

Missing required quality, preferred-market context, or constrained price data
is reported as insufficient information and does not pass eligibility.
Unspecified constraints are informational and do not cause rejection.

## API

`GET /api/buyer-matching/lots/:lotId` requires Clerk authentication and the
trusted `FARMER` role. Optional query parameters are:

- `marketId`: explicit market context used to retrieve the latest trusted
  price for the lot crop
- `eligibleOnly=true|false`
- `page`
- `limit` (maximum 100)

Results contain buyer/demand identifiers and non-sensitive buyer business
information, quantity details, quality/location/price sections, and explicit
reason codes such as `CROP_MATCH`, `QUANTITY_INSUFFICIENT`,
`QUALITY_INFORMATION_INSUFFICIENT`, `PRICE_WITHIN_RANGE`, and
`LOCATION_INFORMATION_INSUFFICIENT`.

Matching is stateless. No Match table is created because results change when
lot status, demand validity, buyer status, quality, or market prices change.
The endpoint performs no writes and uses deterministic buyer/demand ordering.
Future AI and offer/transaction phases may consume these explanations, but
they are intentionally not part of Phase 7.
