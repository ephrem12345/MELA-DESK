# Deployment

## Local Compose

Copy `.env.example` to `.env` and replace every `replace-...` value. Use URL-safe `MYSQL_PASSWORD` values or URL-encode reserved characters in `DATABASE_URL`. Compose binds API, MySQL, and Mailpit ports to loopback. The MySQL volume and private upload volume persist between restarts.

```powershell
docker compose up -d mysql mailpit
docker compose build api
docker compose run --rm api npm run prisma:migrate:deploy
docker compose run --rm api npm run prisma:seed
docker compose up -d api
```

Migrations are explicit release operations; API startup never changes the database schema. To inspect readiness, request `http://localhost:4000/api/ready`. Mailpit runs at `http://localhost:8025`.

## Frontend connection

Set the frontend's local `.env.local` to:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_USE_MOCKS=false
```

Restart Next.js after changing environment variables. The browser calls the API directly with credentialed CORS and CSRF headers.

## Production checklist

- Use separate environment files/secrets for each stage; do not use the local Compose passwords.
- Require a high-entropy `SESSION_SECRET`, `COOKIE_SECURE=true`, TLS, trusted proxy configuration, explicit frontend origins, SMTP credentials, and a private upload volume.
- Keep MySQL private to the application network. Enable encrypted connections and managed backups.
- Run `prisma migrate deploy` as a controlled release step before deploying the API image.
- Configure a shared rate-limit store before running multiple API instances.
- Mount durable private upload storage and configure malware scanning.
- Monitor `/ready`, request logs, failed outbox events, SLA alerts, and database capacity.
