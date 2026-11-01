# MELA DESK backend implementation plan

## Repository findings

- The project is a Next.js 15 / TypeScript frontend with a typed client in `src/lib/api/client.ts`.
- The browser client expects `/api` routes for authentication, tickets, notifications, categories, users, audit logs, dashboard metrics, and reports.
- There are no existing server API routes, Prisma schema, database migrations, backend README, or Git metadata in this workspace.
- The frontend's local `.env.local` currently enables development mocks. It will remain local and untouched until the real API is available.
- The XAMPP MySQL service is listening on port 3306, but no database credentials are configured in the project.

## Implementation plan

1. Add a standalone TypeScript API service on port 4000 and preserve the frontend's existing `/api` contracts. Expose the same DTOs under `/api/v1` for versioned clients.
2. Add a Prisma/MySQL schema for users, sessions, departments, teams, tickets, histories, assignments, comments, attachments, notifications, SLA, audit, idempotency, and outbox records.
3. Implement validated authentication, cookie sessions, CSRF checks, role/resource authorization, request IDs, structured errors, rate limits, and safe uploads.
4. Implement the existing frontend endpoints first, then the additional user/team/admin/report/health endpoints listed in the supplied specification.
5. Add safe development seeds, unit/API tests, OpenAPI documentation, Docker Compose, CI, and the required operational/security documentation.
6. Type-check and run tests against an isolated database when database access is available. Do not apply migrations to an unspecified existing database.

## Contract decisions

- Responses for the existing `/api` frontend routes keep their current DTO shape; they do not receive a new success envelope that would break the client.
- `/api/v1` initially uses the same DTOs, while errors include stable error codes and request IDs.
- Password-reset messages are queued for a configured mail transport; the API never returns reset tokens.
- Ticket records and histories are soft-deleted or retained; user deactivation does not cascade-delete ticket or audit history.
