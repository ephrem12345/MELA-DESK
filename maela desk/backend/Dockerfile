FROM node:24-bookworm-slim AS build
WORKDIR /workspace

COPY backend/package.json ./backend/package.json
WORKDIR /workspace/backend
RUN npm install

WORKDIR /workspace
COPY backend ./backend
COPY prisma ./prisma
WORKDIR /workspace/backend
RUN DATABASE_URL="mysql://build:build@127.0.0.1:3306/build" npm run prisma:generate
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /workspace/backend
RUN groupadd --system --gid 10001 mela && useradd --system --uid 10001 --gid mela --home-dir /workspace/backend mela

COPY --from=build --chown=mela:mela /workspace/backend/package.json ./package.json
COPY --from=build --chown=mela:mela /workspace/backend/node_modules ./node_modules
COPY --from=build --chown=mela:mela /workspace/backend/dist ./dist
COPY --from=build --chown=mela:mela /workspace/backend/generated ./generated
COPY --from=build --chown=mela:mela /workspace/backend/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=mela:mela /workspace/prisma /workspace/prisma
RUN mkdir -p /workspace/backend/var/private-uploads && chown -R mela:mela /workspace/backend/var

USER mela
EXPOSE 4000
CMD ["node", "dist/src/server.js"]
