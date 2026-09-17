# Database foundation

KrishiSetu uses Supabase PostgreSQL through Prisma. Supabase is the database
platform for this phase; Supabase Auth and Supabase Storage are not used yet.
Clerk remains the planned authentication provider for Phase 2.

## Required environment

Copy `.env.example` to `.env` and set `DATABASE_URL` to the Supabase PostgreSQL
connection string supplied by the project owner. Never commit `.env` or a
connection string.

## Prisma commands

From the repository root:

```bash
npm run prisma:generate --workspace backend
npm run prisma:validate --workspace backend
npm run prisma:db-push --workspace backend
```

The project intentionally does not commit Prisma migration files. Development
schema changes are applied to the Supabase development project with
`prisma db push` after reviewing the schema. This avoids adding a migration
workflow to source control, and `prisma db push` must never be run against a
production database.

## Models

The initial schema contains `User`, `Farmer`, `FPO`, `Buyer`, `Market`,
`MarketPrice`, `Lot`, and `BuyerDemand`. It contains no seed data and no
operational transaction, payment, logistics, quality, or AI models.

Database tables use explicit snake_case names through Prisma `@@map` and
`@map` conventions where applicable. Coordinates use PostgreSQL-compatible
`Float` columns; PostGIS is intentionally not required in Phase 1.

## Connectivity

The backend exposes `GET /api/db-health`. It returns a safe configuration
error when `DATABASE_URL` is absent, or checks PostgreSQL with Prisma when the
variable is configured:

```bash
curl http://localhost:4000/api/db-health
```

## Row-level security

RLS is planned for the Supabase tables, but no broad or insecure policies are
created in Phase 1. Clerk authentication and the application authorization
boundary do not exist yet, so policies requiring verified identity claims
must be designed and applied in Phase 2. The backend is the only application
layer responsible for database access during this phase.
