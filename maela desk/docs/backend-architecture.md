# Backend architecture

The frontend remains in Next.js. A separate Express 5 API runs on port 4000, with modular routes, services, repositories through Prisma, shared validation, policies, and middleware in `backend/src`. The API uses Node.js and TypeScript strict mode.

## Request flow

1. Request ID, HTTP security headers, CORS, size limits, rate limits, cookies, and CSRF checks run before routes.
2. Route schemas validate params, query values, and JSON bodies with Zod.
3. Authentication loads a hashed opaque session token from an HTTP-only cookie. Authorization evaluates role, requester ownership, department, team membership, and assignment on the server.
4. Services use Prisma transactions for ticket creation, assignment, status changes, comments, audit events, notifications, and outbox work.
5. DTO mappers return explicit frontend-compatible objects; Prisma records are never returned directly.

## Persistence

MySQL 8.4 is the reference local deployment. Prisma migrations own the schema. Prisma 7 connects through its supported MySQL/MariaDB driver adapter; the existing `mysql2` package provides a separate bounded readiness probe. Both use the same `DATABASE_URL`.

Ticket IDs are UUIDs. Human ticket numbers come from a transactional sequence row with a unique database constraint. Updates use a version column and a compare-and-update operation. Assignment and status histories are append-only records. Ticket and audit history are not cascade-deleted when a user is deactivated.

## Async work

Notifications are written in the same transaction as their triggering ticket change. Optional email work is encrypted in a durable outbox and retried with backoff. The SLA worker scans bounded batches and uses database claims to prevent duplicate alerts across API instances. Housekeeping removes expired sessions, password-reset tokens, idempotency rows, and unattached expired uploads; audit records and ticket history are retained.

## API versions

`/api/v1` is the canonical route prefix. `/api` is mounted as a compatibility alias because the existing frontend already calls it. Both prefixes return the frontend's existing DTO shape. Error responses include a stable code and request ID.
