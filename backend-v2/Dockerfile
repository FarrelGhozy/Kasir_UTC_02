# Backend v2 — Bun + Elysia + Prisma
FROM oven/bun:1.3 AS base
WORKDIR /app

# Deps + source
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production || bun install --production
COPY prisma ./prisma
RUN bunx prisma generate

COPY src ./src
COPY .env.example ./.env.example

ENV NODE_ENV=production
EXPOSE 5300
CMD ["bun", "src/index.ts"]