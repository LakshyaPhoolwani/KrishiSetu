# Farmer management foundation

Phase 3 provides deterministic backend APIs for the authenticated farmer
domain:

```text
User -> Farmer -> Farm -> Crop -> Lot
```

No market, matching, pricing, logistics, payment, AI, or external API
behavior is included.

## Models

- `Farmer` is a one-to-one extension of the authenticated `User`.
- `Farm` belongs to one Farmer and stores structured address, coordinates,
  positive area, and `ACRE`/`HECTARE` units.
- `Crop` is reference data with name, variety, category, and season.
- `Lot` belongs to a Farmer, Farm, and Crop. It has a server-generated unique
  `lotCode`, positive quantity, controlled units, optional dates, basic
  farmer-provided quality notes, and a controlled lifecycle.
- Existing `FPO` relationships are reused; Phase 3 does not expose FPO
  assignment or aggregation APIs.

## Endpoints

Farmer profile:

- `GET /api/farmers/me`
- `PATCH /api/farmers/me`

Farms:

- `POST /api/farms`
- `GET /api/farms?page=1&limit=20`
- `GET /api/farms/:id`
- `PATCH /api/farms/:id`
- `DELETE /api/farms/:id`

Crop reference data:

- `GET /api/crops`
- `GET /api/crops/:id`

Lots:

- `POST /api/lots`
- `GET /api/lots?page=1&limit=20&status=DRAFT&cropId=&farmId=`
- `GET /api/lots/:id`
- `PATCH /api/lots/:id`
- `DELETE /api/lots/:id`

All management routes require Clerk authentication and the trusted database
role `FARMER`. Ownership is resolved from the authenticated internal User to
Farmer and then to Farm/Lot. Client-supplied `userId`, `farmerId`, `lotCode`,
role, and ownership values are never trusted.

## Validation and lifecycle

Zod validates request bodies, IDs, coordinates, pincode, positive quantities and
areas, enums, pagination, and harvest date relationships. Newly created lots
start as `DRAFT`. Phase 3 permits only `DRAFT` and `READY_FOR_MARKET` in farmer
updates; later operational statuses cannot be self-assigned.

Lot codes are generated server-side with a UUID-backed candidate and protected
by the database unique constraint. No row-count-based code generation is used.

## Deletion and future extensions

Phase 3 uses ownership-checked deletion and does not introduce a new soft
deletion convention. Farms with lots cannot be deleted, preserving lot
relationships for future phases. Market data, FPO aggregation, quality
verification, storage, and transactions remain future work.
