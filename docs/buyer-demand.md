# Buyer and Buyer Demand

Phase 5 adds backend-only buyer onboarding data and private buyer demand
management. It does not implement matching, offers, transactions, pricing
recommendations, or farmer-facing demand discovery.

## Models

`Buyer` belongs one-to-one with the internal `User` through `userId`. Buyer
profiles contain business/contact details, a controlled `BuyerType`, and a
server-controlled `BuyerStatus` that defaults to `PENDING_VERIFICATION`.

`BuyerDemand` belongs to one Buyer and one existing Crop. It stores quantity
and `QuantityUnit`, optional minimum quantity, optional preferred Market and
location, optional price bounds, quality requirements, and validity dates.
Foreign keys prevent orphan crops or markets.

## Lifecycle

Demand status is one of `DRAFT`, `ACTIVE`, `PAUSED`, `FULFILLED`, `EXPIRED`,
or `CANCELLED`. Allowed transitions are:

- `DRAFT -> ACTIVE | CANCELLED`
- `ACTIVE -> PAUSED | FULFILLED | EXPIRED | CANCELLED`
- `PAUSED -> ACTIVE | CANCELLED`

`DELETE /api/buyer-demands/:id` is a controlled cancellation operation; it
does not physically delete demand history.

## APIs and authorization

All endpoints require Clerk authentication and the trusted database `BUYER`
role:

- `GET /api/buyers/me`
- `PATCH /api/buyers/me`
- `POST /api/buyer-demands`
- `GET /api/buyer-demands`
- `GET /api/buyer-demands/:id`
- `PATCH /api/buyer-demands/:id`
- `DELETE /api/buyer-demands/:id`

Buyer ownership is resolved from Clerk identity to internal User to Buyer.
Client-supplied `buyerId`, `userId`, `clerkUserId`, role, status, and
verification fields are not accepted. Demand lists are always scoped to the
authenticated Buyer and support bounded pagination and filters for crop,
status, preferred market, state, district, and validity dates.

## Validation and future integration

Quantities must be positive and use an existing quantity unit. Coordinates,
prices, IDs, enum values, and dates are validated; minimum prices cannot
exceed maximum prices, and validity dates must be ordered. Phase 7 may consume
these private demands for matching, but no matching behavior is included here.
