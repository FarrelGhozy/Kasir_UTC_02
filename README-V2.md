# Kasir UTC v2 — Rancangan Baru

Arsitektur baru berbasis modern stack, dikerjakan **paralel** di samping v1 (produksi tetap jalan).

## Stack
| Layer | v1 (produksi) | v2 (baru) |
|---|---|---|
| Frontend | Vanilla JS + Bootstrap + Tailwind + Chart.js | **React 18 + React Router 6 + Tailwind + Vite** |
| Backend | Node.js Express 5 + Mongoose | **Bun 1.3 + Elysia** |
| Database | MongoDB (27018) | **PostgreSQL 16 + Prisma 6** (27019) |

## Port (v1 tetap jalan, v2 di sampingnya)
| Service | v1 | v2 |
|---|---|---|
| Backend | 5200 | **5300** |
| Frontend | 8080 | **8090** |
| MongoDB | 27018 | — |
| PostgreSQL | — | **27019** |

## Cara run dev

```bash
# 1. PostgreSQL v2 (sudah jalan sebagai docker container utc_pg_v2)
docker ps --filter name=utc_pg_v2

# 2. Backend v2
cd backend-v2
bun install
cp .env .env.local   # atau edit .env set JWT_SECRET
bun run prisma/seed.ts       # seed admin pertama kali
bun src/index.ts             # → http://localhost:5300

# 3. Frontend v2
cd frontend-v2
bun install
bun run dev                  # → http://localhost:8090
```

Credential seed: `admin` / `Admin@utc2026` (khusus dev, ganti sebelum produksi).

## Struktur
```
backend-v2/
  prisma/          # schema.prisma + migrations + seed
  src/
    config/        # env validation (SEC hardening aktif)
    db/ models/ services/ controllers/ routes/ middleware/ utils/
frontend-v2/
  src/
    routes/ pages/ components/ contexts/ hooks/ lib/ assets/
```

## Catatan keamanan
- `JWT_SECRET` di `.env` wajib ≥32 char, reject placeholder (lihat `src/config/env.ts`).
- CORS origin eksplisit (bukan `*`) — lihat `.env` `CORS_ORIGIN`.
- .env tidak pernah di-commit (terlindungi `.gitignore`).

## Referensi
- Roadmap issue: `#85` (ini) → `#86` (DB+migrasi) → `#87–90` (fix logic) → `#91` (security) → `#92–93` (frontend).
- Audit detail: `docs/v2-audit/*`