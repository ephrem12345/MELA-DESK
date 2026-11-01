# Security controls

- Argon2id hashes passwords with configurable memory/time/parallelism values. Passwords and hashes are never returned in DTOs or written to audit records.
- Login failures use generic responses, per-IP rate limits, progressive account lockouts, and audit outcomes. Inactive users cannot authenticate.
- Sessions use random 384-bit values in HTTP-only cookies; only SHA-256 token hashes are stored. Production cookies are Secure and have configurable SameSite settings.
- Mutating cookie-authenticated requests require a double-submit CSRF token and a configured Origin. CORS allows only explicit origins with credentials.
- Authorization is enforced in route services for role, ownership, team, department, assignment, and comment visibility. Inaccessible ticket IDs return 404 to prevent resource enumeration.
- Zod rejects unknown/protected fields. Prisma parameterizes database operations. Sort columns and pagination are allowlisted and bounded.
- Private uploads are limited to configured extensions, 10 MiB by default, signature-checked where supported, stored under server-generated random names outside public directories, and streamed only after authorization.
- Helmet headers, body limits, structured logs, request IDs, and secret-field redaction are enabled. Health endpoints expose no credentials or stack traces.
- Password-reset tokens are single-use, expiring, and stored as hashes. The outbox stores only encrypted delivery payloads. Failed email delivery does not roll back the committed account or ticket transaction.

## Operational limits

The bundled rate limiter is in-memory and appropriate for a single API process. A multi-instance deployment needs a shared rate-limit store before horizontal scaling. Malware scanning is not configured; production deployments should add a scanner or object-storage quarantine workflow. Configure SMTP and HTTPS before enabling public password resets or production traffic.
