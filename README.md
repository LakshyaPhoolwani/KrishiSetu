# KrishiSetu

KrishiSetu is an AI-powered agricultural market-linkage and price-discovery platform designed to help farmers decide where, when, and to whom they should sell. The platform is designed to optimize expected net realization rather than simply the highest listed price.

## Architecture overview

The project follows a monorepo layout with separate workspaces for the web app, mobile app, backend, and shared support packages.

- Web app: React + TypeScript + Vite
- Mobile app: React Native + Expo + TypeScript
- Backend: Node.js + Express + TypeScript
- Database: Supabase PostgreSQL + Prisma
- Authentication: Clerk
- Shared packages: types, validation, API client, and constants

## Tech stack

- React
- TypeScript
- Vite
- Tailwind CSS
- React Native / Expo
- Node.js
- Express
- Supabase PostgreSQL
- Prisma
- Clerk

## Monorepo structure

```text
/
├── apps/
│   ├── web/
│   └── mobile/
├── backend/
├── packages/
│   ├── types/
│   ├── validation/
│   ├── api-client/
│   └── constants/
├── contracts/
├── docs/
├── .github/
│   └── workflows/
├── AI_RULES.md
├── PROJECT_CONTEXT.md
├── PROJECT_STATUS.md
├── README.md
├── .gitignore
├── .env.example
├── package.json
└── package-lock.json
```

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Start the web app:

```bash
npm run dev
```

3. Start the backend:

```bash
npm run dev:backend
```

4. Start the mobile app:

```bash
npm run dev:mobile
```

## Development commands

```bash
npm run dev
npm run dev:backend
npm run dev:mobile
npm run build
npm run test
npm run lint
npm run format
npm run typecheck
```

## Environment variables

Use a `.env` file locally based on `.env.example`.

```bash
cp .env.example .env
```

The current foundation only requires placeholders for local development and does not include production secrets.

## Database setup

Phase 1 uses Supabase PostgreSQL through Prisma. See
[docs/database.md](docs/database.md) for environment variables, the
non-migration `prisma db push` policy, schema details, RLS planning, and the
database health check.

## Current phase

Phase 2 is the Clerk authentication and authorization foundation stage. No
production business features are implemented yet. Phase 3 adds the backend
Farmer/Farm/Crop/Lot foundation. See
[docs/authentication.md](docs/authentication.md) for the backend flow and
webhook setup and [docs/farmer-management.md](docs/farmer-management.md) for
the Phase 3 API and ownership rules.

## Collaboration rules

- Keep frontend and backend changes independent whenever possible.
- Do not implement future business features in this phase.
- Keep changes focused and avoid unrelated edits.
- Keep public contracts stable unless explicitly instructed otherwise.

## Future roadmap

This repository is intentionally limited to initial project scaffolding. Future phases will add backend services, database foundations, authentication, market data, buyer logic, AI automation, and product features across web and mobile platforms.
