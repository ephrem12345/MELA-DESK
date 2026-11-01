# MELA DESK

MELA DESK is an IT support desk frontend with a separate Node.js API and MySQL database. The API preserves the response DTOs used by the existing frontend and exposes the same routes under both `/api` and `/api/v1`.

## Local development

Requirements: Node.js 24, npm, Docker Compose with MySQL support, and a local copy of the environment files.

1. Copy `.env.example` to `.env` and replace the local placeholder passwords and session secret with random values. Keep `.env` out of source control.
2. Start the database and local mail sink:

   ```powershell
   docker compose up -d mysql mailpit
   ```

3. Build the API image, apply the checked-in migrations, and seed the development accounts:

   ```powershell
   docker compose build api
   docker compose run --rm api npm run prisma:migrate:deploy
   docker compose run --rm api npm run prisma:seed
   docker compose up -d api
   ```

4. In the frontend's `.env.local`, set `NEXT_PUBLIC_API_URL=http://localhost:4000/api` and `NEXT_PUBLIC_USE_MOCKS=false`, then restart Next.js.
5. Start the frontend from the `maela desk` directory with `npm run dev`.

The API health endpoint is `http://localhost:4000/api/health`; readiness is `http://localhost:4000/api/ready`. Mailpit's local inbox is at `http://localhost:8025`.

For a local XAMPP MySQL installation, copy `backend/.env.example` to `backend/.env`, set `DATABASE_URL` to a dedicated MELA DESK database, and run the backend package scripts from `backend/`. Do not point development migrations at a database containing unrelated or production data.

## Development accounts

The seed creates requester, agent, team lead, and administrator accounts using `DEV_SEED_PASSWORD` from the local environment. Set it to the same local development password shown in the login UI. The seed refuses to run when `NODE_ENV=production`.

## API and security references

- [API reference](./docs/api-reference.md) and [OpenAPI specification](./docs/openapi.yaml)
- [Architecture](./docs/backend-architecture.md) and [database schema](./docs/database-schema.md)
- [Security](./docs/security.md), [deployment](./docs/deployment.md), and [backup/recovery](./docs/backup-and-recovery.md)
- [Testing](./docs/testing.md) and [localization](./docs/localization.md)

See [the backend handoff plan](./docs/backend-implementation-plan.md) for discovered constraints and implementation decisions.
