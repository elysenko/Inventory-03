# StockRoom

Single-tenant inventory management. Staff browse a catalogue of items and stock
locations, record stock movements (`IN`, `OUT`, `TRANSFER`) that atomically
adjust per-location balances, and read an audit log of every movement.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 19, standalone components (`frontend/`) |
| Backend | NestJS 11, REST under `/api` (`backend/`) |
| ORM | Prisma 6 |
| Database | PostgreSQL |
| Auth | JWT bearer (HS256), roles `manager` and `clerk` |

## Roles

- **manager** — everything a clerk can do, plus catalogue and location writes,
  the movement audit log, the low-stock report and `/admin/settings`.
- **clerk** — browse items and locations, view an item's movement history, and
  record movements.

The first account created through `POST /api/auth/signup` on an empty database
becomes a `manager`; every later signup is a `clerk`. Because the seed inserts
its users directly, a seeded deployment's only manager is the seeded one.

## Demo credentials

| Email | Password | Role |
|---|---|---|
| `manager@demo` | `Demo1234!` | manager |
| `clerk@demo` | `Demo1234!` | clerk |

## Local development

```bash
# 1. Database (or point DATABASE_URL at any Postgres 16 instance)
docker compose up -d postgres

# 2. API
cd backend
cp ../.env.example .env          # then edit DATABASE_URL / JWT_SECRET
npm install
npx prisma migrate deploy        # or `npm run prisma:migrate` while iterating
npx prisma generate
npm run prisma:seed              # idempotent; set SEED_ON_BOOT=false to skip
npm run start:dev                # http://localhost:3001/api

# 3. SPA (separate shell)
cd frontend
npm install
npx ng serve                     # http://localhost:4200, proxied to the API
```

Swagger for the whole API is served at <http://localhost:3001/api/docs>.

## API

All routes are prefixed with `/api`. Every endpoint requires a bearer token
except those marked public. An unauthenticated call returns **401**; an
authenticated call by the wrong role returns **403** — the two are never
conflated.

| Method + path | Access |
|---|---|
| `GET /api/health`, `GET /api/health/deep` | public |
| `POST /api/auth/login`, `POST /api/auth/signup` | public |
| `GET /api/auth/me` | authenticated |
| `GET /api/items` (`?q=&lowStock=&page=&pageSize=`) | clerk + manager |
| `GET /api/items/:id` (with per-location `stockLevels`) | clerk + manager |
| `GET /api/items/:id/movements` | clerk + manager |
| `POST /api/items`, `PATCH /api/items/:id`, `DELETE /api/items/:id` | manager |
| `GET /api/locations`, `GET /api/locations/:id` | clerk + manager |
| `POST /api/locations`, `PATCH /api/locations/:id`, `DELETE /api/locations/:id` | manager |
| `POST /api/movements` | clerk + manager |
| `GET /api/movements` (`?itemId=&type=&from=&to=&locationId=&page=`) | manager |
| `GET /api/reports/low-stock` | manager |
| `GET /api/admin/settings`, `PATCH /api/admin/settings` | manager |

List endpoints return `{ data, total, page, pageSize, totalPages }`.
`GET /api/locations` and `GET /api/reports/low-stock` return bare arrays.

## Invariants

- `IN` names only a destination, `OUT` only a source, `TRANSFER` both and they
  must differ; `qty >= 1`. Anything else is a 400 before any row is touched.
- A movement's balance updates and its audit row are written in a single
  `Serializable` transaction, retried once on a serialization failure.
- An over-draw can never write: the `qty >= requested` guard lives in the
  `UPDATE ... WHERE` clause, so it matches zero rows, and the resulting 400
  rolls the transaction back with the stored balance unchanged.
- The sum of an item's per-location quantities always equals its `totalOnHand`.
- Low stock is `SUM(stockLevel.qty) <= item.reorderAt` across all locations —
  `<=`, so the exact boundary is listed, and via a `LEFT JOIN`, so items with no
  stock rows at all are listed too.
- Items and locations still holding stock or referenced by the audit log cannot
  be deleted (409), which keeps movement history referentially intact.

## Configuration

See `.env.example`. Only `DATABASE_URL` and `JWT_SECRET` are app-owned config the
platform always provisions. Every third-party credential is optional: a missing
value degrades the dependent feature to HTTP 503 and never crash-loops the pod.
Optional credentials can also be set at runtime from `/admin/settings`, which
writes a `SystemSetting` row that `resolveConfig()` falls back to when the
environment variable is absent.
