# Net Realisation Engine

Phase 6 provides a deterministic backend calculation for a farmer-owned lot
and a selected market-price observation. It does not select markets or buyers,
call transport providers, forecast prices, or implement matching.

## Formula

```text
saleRevenue = saleQuantityInQuintals * trustedModalPricePerQuintal
commissionCost = explicit commissionCost OR saleRevenue * commissionRate / 100
expectedLossCost = saleRevenue * expectedLossPercentage / 100
totalCosts = transport + storage + commission + packaging + expectedLoss + other
netRealisation = saleRevenue - totalCosts
```

Quantity conversion is explicit: `100 KG = 1 QUINTAL` and `1 TON = 10
QUINTAL`. The referenced `MarketPrice.modalPrice` is the only accepted sale
price and must use `INR_PER_QUINTAL`.

## Precision and auditability

Inputs are decimal strings and calculations use Prisma Decimal arithmetic.
Intermediate values retain Decimal precision. Monetary output fields are
rounded once to two decimal places using half-up rounding. Negative net
realisation is preserved; it is not clamped to zero.

Each calculation is persisted in `NetRealisationCalculation`, including the
input quantities, price context, every cost category, loss percentage, and
derived totals. This preserves an auditable breakdown and reproducibility.

## API and security

`POST /api/net-realisation/calculate` requires Clerk authentication and the
trusted `FARMER` role. The lot is resolved through authenticated User ->
Farmer -> Lot ownership. The supplied market price must match the requested
market and the lot crop. Clients cannot supply derived revenue, total costs,
net realisation, ownership, or sale price values.

All costs and percentages are non-negative; percentages cannot exceed 100.
Sale quantity must be positive and cannot exceed the owned lot quantity.
No external APIs or future-phase matching logic are used.
