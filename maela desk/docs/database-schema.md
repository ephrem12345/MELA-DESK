# Database schema

The Prisma schema is in `prisma/schema.prisma`; migrations are stored under `prisma/migrations`.

| Domain | Tables |
|---|---|
| Identity | `users`, `sessions`, `password_reset_tokens`, `email_verification_tokens`, `notification_preferences` |
| Organization | `departments`, `teams`, `team_members` |
| Tickets | `tickets`, `ticket_sequences`, `ticket_categories`, `ticket_priorities`, `ticket_status_history`, `ticket_assignments`, `ticket_comments`, `ticket_attachments` |
| Operations | `sla_policies`, `sla_tracking`, `notifications`, `audit_logs`, `outbox_events`, `idempotency_records`, `system_settings` |

All IDs are UUIDs except the singleton ticket sequence key. Timestamps use UTC `DATETIME(3)`. Foreign keys and indexes support requester, status, priority, assignment, team, department, category, creation-time, notification, and audit lookups. Password reset and session tokens are stored as SHA-256 hashes. Password-reset delivery payloads in the outbox are encrypted with a key derived from `SESSION_SECRET`.

The default SLA calendar uses elapsed minutes. Business-hours policies use UTC day names and `HH:mm` intervals, with configured holiday dates. Deployments that require local time zones should standardize the business-hours JSON in the organization before enabling business-hour mode.

Ticket numbers are allocated by atomically incrementing `ticket_sequences` inside the ticket-creation transaction. This avoids scanning ticket history and prevents concurrent number collisions.
