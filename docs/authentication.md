# Authentication and authorization

Phase 2 uses Clerk for authentication and the KrishiSetu backend for
application identity and authorization.

## Flow

1. Clerk authenticates the user and provides a session token.
2. `@clerk/express` verifies the request on the backend.
3. `requireAuth` extracts the verified Clerk user ID.
4. The backend looks up the application `User` by `clerkUserId`.
5. The database-backed role and status are attached to the typed request
   context.
6. `requireRole` and future ownership middleware authorize application actions.

The client cannot choose the identity, database user ID, role, or status.

## Environment variables

Set these in a local `.env` file; never commit the file:

```text
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=
```

`CLERK_SECRET_KEY` and `CLERK_WEBHOOK_SIGNING_SECRET` are server-only. The
publishable key is documented for coordinated future client integration but is
not used by the Phase 2 backend.

## User synchronization

`POST /api/webhooks/clerk` verifies Clerk webhook signatures using the official
`verifyWebhook` helper from `@clerk/express/webhooks`. It handles:

- `user.created`: idempotent Prisma upsert with a safe default `FARMER` role.
- `user.updated`: updates profile fields without changing role or status.
- `user.deleted`: marks the application user `INACTIVE`.

The `clerkUserId` database uniqueness constraint prevents duplicate records.
Webhook payloads are validated before they are applied.

## Protected endpoints

- `GET /api/auth/me`
- `GET /api/users/me`
- `PATCH /api/users/me`

Profile updates accept only `name` and `phone`. They cannot modify identity,
role, status, or timestamps.

## Authorization

Application roles are stored in the Prisma `Role` enum and read from the
database. Privileged roles cannot be self-assigned. `requireOwnership` provides
the reusable foundation for comparing a resource owner ID with the trusted
authenticated database user ID.

## RLS strategy

Prisma connections do not automatically carry the end-user Clerk identity.
Phase 2 therefore uses backend authorization as the application authorization
boundary and does not add broad or anonymous Supabase RLS policies. Identity-
aware database policies require an explicit later design for propagating
verified identity into database sessions.

## Testing

The local tests mock Clerk request verification and cover unauthenticated
requests, database identity mapping, and the webhook configuration boundary.
Real Clerk credentials and a real Clerk webhook delivery must be configured
separately for end-to-end verification.

No frontend/mobile authentication UI is included in this phase.
