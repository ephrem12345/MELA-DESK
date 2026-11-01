# API reference

All routes are available under `/api/v1`. The existing frontend's `/api` prefix is retained as an alias.

## Frontend-integrated routes

| Method | Path | Access | Response |
|---|---|---|---|
| GET | `/auth/csrf` | Public | `{ token }` and CSRF cookie |
| POST | `/auth/register` | Public, rate-limited | `{ user }` and session cookie |
| POST | `/auth/login` | Public, rate-limited | `{ user }` and session cookie |
| POST | `/auth/logout` | CSRF protected | 204 |
| GET | `/auth/me` | Authenticated | `{ user }` |
| POST | `/auth/forgot-password` | Public, rate-limited | Generic `{ accepted: true }` |
| POST | `/auth/reset-password` | Public, rate-limited | 204 |
| POST | `/auth/change-password` | Authenticated | 204 |
| GET / POST | `/tickets` | Authenticated | Paginated tickets / `{ ticket }` |
| GET / PATCH | `/tickets/:id` | Authorized | Ticket detail / `{ ticket }` |
| POST | `/tickets/:id/status` | Support staff | `{ ticket }` |
| POST | `/tickets/:id/priority` | Support staff | `{ ticket }` |
| POST | `/tickets/:id/assign` | Authorized support staff | `{ ticket }` |
| POST | `/tickets/:id/escalate` | Authorized support staff | `{ ticket }` |
| POST | `/tickets/:id/replies` | Ticket owner or support staff | `{ message: { id } }` |
| POST | `/tickets/:id/notes` | Support staff only | `{ message: { id } }` |
| POST | `/tickets/:id/resolve`, `/close`, `/reopen` | Policy controlled | `{ ticket }` |
| GET | `/tickets/:id/history`, `/comments`, `/sla` | Authorized | Ticket history, public/staff comments, SLA |
| POST | `/attachments` | Authenticated, rate-limited | Staged `{ id }` |
| GET | `/attachments/:ticketId/:id` | Authorized | Private attachment stream |
| GET | `/dashboard/stats` | Authenticated and scoped | Dashboard metrics |
| GET | `/categories`, `/priorities` | Authenticated | Active catalog items |
| GET | `/notifications` | Authenticated | `{ items, total }` |
| POST / PATCH | `/notifications/:id/read` | Recipient only | 204 |
| POST | `/notifications/read-all` | Authenticated | `{ updated }` |
| GET | `/users` | Administrator or scoped team lead | Paginated users |
| GET | `/audit-logs` | Administrator | Paginated audit entries |
| GET | `/reports/summary` | Administrator or team lead | Dashboard report DTO |

## Administrative and supporting routes

The API also provides user create/update/status/role routes; department and team CRUD and membership routes; category and priority management; SLA policy routes; settings read/update; report endpoints for tickets, agents, and SLA; attachment list/delete; `GET /health`; and `GET /ready`.

## Request/response rules

- Bodies, query strings, path parameters, filters, and sort fields are validated with Zod. Unknown fields are rejected on write operations.
- Pages are one-based, default page size is 25, maximum page size is 100.
- Existing success payloads stay DTO-compatible with the frontend. Error responses use `{ success:false, error:{ code, message, details, requestId } }`.
- Authentication uses a server-side session cookie. State-changing cookie requests require the CSRF cookie value in `X-CSRF-Token` and an allowed `Origin`.
- Requester ticket reads are always constrained by the authenticated requester ID. Internal notes are filtered server-side.

See [openapi.yaml](./openapi.yaml) for the machine-readable contract.
